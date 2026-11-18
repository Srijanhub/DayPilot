"""
DayPilot FastAPI Backend Server
Runs on 127.0.0.1:4000 with strict CORS.
Provides real-time telemetry ingestion, context classifier, and briefing endpoints.
"""

import os
import json
import time
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import asynccontextmanager
import asyncio
import httpx

from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import get_db_connection, init_db, get_today_range, upsert_bookmark
from media_parser import parse_media_info
from classifier import ContextClassifier
from dotenv import load_dotenv
load_dotenv()

from auth import DAYPILOT_API_TOKEN, verify_daypilot_token, DEFAULT_DISALLOWED_TOKEN

DEFAULT_BROWSER = os.environ.get("DAYPILOT_BROWSER", "Opera GX")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Enforce rejection of default weak token on startup
    if DAYPILOT_API_TOKEN == DEFAULT_DISALLOWED_TOKEN or os.environ.get("DAYPILOT_API_TOKEN") == DEFAULT_DISALLOWED_TOKEN:
        raise RuntimeError(
            f"Startup rejected: Insecure default token '{DEFAULT_DISALLOWED_TOKEN}' is in use. "
            "Please remove it from .env to auto-generate a secure random token in ~/daypilot/token."
        )

    # Modern lifespan handler (replaces deprecated @app.on_event("startup"))
    init_db()
    from unified_syncer import sync_engine
    sync_engine.set_broadcast_callback(broadcast_state)
    sync_task = asyncio.create_task(sync_engine.start_background_loop())
    expiry_task = asyncio.create_task(_expire_open_tabs_loop())
    yield
    expiry_task.cancel()
    sync_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="DayPilot Engine", version="1.0.0", lifespan=lifespan)

# Router with router-level dependency protecting all state-changing endpoints
authenticated_router = APIRouter(dependencies=[Depends(verify_daypilot_token)])

# Strict CORS: Allow only localhost:3000 and browser extension origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^chrome-extension://[a-zA-Z0-9]+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/token")
def get_public_token():
    """Returns the local token for local companion extensions and dashboards."""
    return {"token": DAYPILOT_API_TOKEN}


# Active Context Classifier instance
classifier = ContextClassifier()

# Connected WebSocket clients
active_websockets: List[WebSocket] = []


class HeartbeatPayload(BaseModel):
    app_name: str
    window_title: Optional[str] = None
    domain: Optional[str] = None
    url: Optional[str] = None
    duration_seconds: int = 5
    idle_seconds: int = 0
    # Optional media metadata
    media_type: Optional[str] = None  # MANHWA, SHOW, YOUTUBE_MUSIC
    series_title: Optional[str] = None
    unit_label: Optional[str] = None  # e.g. "Chapter 148", "Episode 4"
    timestamp_offset: Optional[str] = None


class OverridePayload(BaseModel):
    mode: str  # AUTO, FORCE_WORK, FORCE_STUDY, FORCE_RELAX


async def broadcast_state(event_type: str, data: Dict[str, Any]):
    message = json.dumps({"type": event_type, "data": data})
    disconnected = []
    for ws in active_websockets:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in active_websockets:
            active_websockets.remove(ws)


@app.websocket("/ws/state")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    # Immediately send current state
    await websocket.send_text(json.dumps({
        "type": "INITIAL_STATE",
        "data": {
            "mode": classifier.committed_mode,
            "override": classifier.manual_override,
            "timestamp": time.time()
        }
    }))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in active_websockets:
            active_websockets.remove(websocket)


def query_live_tab() -> Dict[str, Any]:
    """Single-connection helper for querying current active tab and dwell time."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT * FROM activity_events
        ORDER BY id DESC LIMIT 1;
        """)
        row = cursor.fetchone()

        if not row:
            return {"is_active": False}

        # A heartbeat older than 30s means nothing is actively focused right now
        cursor.execute(
            "SELECT CAST(strftime('%s','now') AS INTEGER) - CAST(strftime('%s', ?) AS INTEGER);",
            (row["timestamp"],),
        )
        age = cursor.fetchone()[0]
        if age is None or age > 30:
            return {"is_active": False}

        # Count consecutive heartbeats on same title/domain
        cursor.execute("""
        SELECT SUM(duration_seconds) as current_dwell
        FROM (
            SELECT duration_seconds, window_title
            FROM activity_events
            ORDER BY id DESC LIMIT 100
        )
        WHERE window_title = ?;
        """, (row["window_title"],))
        dwell_row = cursor.fetchone()
        dwell_sec = dwell_row["current_dwell"] if dwell_row and dwell_row["current_dwell"] else 5

        return {
            "is_active": True,
            "app_name": row["app_name"],
            "window_title": row["window_title"] or "Active Window",
            "domain": row["domain"] or "desktop",
            "url": row["url"] or "",
            "category": row["category"] or "WORK",
            "dwell_seconds": dwell_sec,
            "last_heartbeat": row["timestamp"]
        }
    finally:
        conn.close()


@app.get("/api/tabs/live")
async def get_live_tab():
    return query_live_tab()

# ---------------------------------------------------------------------------
# Currently open browser tabs: a live snapshot pushed by the extension.
# Nothing is read from history; a stale snapshot (browser closed, extension
# paused/disconnected) expires on its own, so closed tabs never linger.
# ---------------------------------------------------------------------------
OPEN_TABS_TTL_SECONDS = 20
_open_tabs: Dict[str, Any] = {"tabs": [], "updated_at": 0.0}


class OpenTab(BaseModel):
    id: int
    window_id: Optional[int] = None
    title: str = ""
    url: str
    active: bool = False    # active tab within its window
    focused: bool = False   # active tab of the window you are using right now


class OpenTabsPayload(BaseModel):
    tabs: List[OpenTab] = Field(default_factory=list)


def _open_tabs_view() -> Dict[str, Any]:
    fresh = _open_tabs["updated_at"] > 0 and (time.time() - _open_tabs["updated_at"]) <= OPEN_TABS_TTL_SECONDS
    return {
        "connected": fresh,
        "tabs": _open_tabs["tabs"] if fresh else [],
        "updated_at": _open_tabs["updated_at"],
    }


@authenticated_router.post("/api/tabs/open")
async def report_open_tabs(payload: OpenTabsPayload):
    from urllib.parse import urlparse
    tabs = []
    for t in payload.tabs:
        if not t.url.startswith(("http://", "https://")):
            continue
        host = urlparse(t.url).hostname or ""
        tabs.append({
            "id": t.id,
            "window_id": t.window_id,
            "title": t.title or host,
            "url": t.url,
            "domain": host,
            "active": t.active,
            "focused": t.focused,
            "category": classifier.classify_target(DEFAULT_BROWSER, host, t.title),
        })
    signature = lambda items: [(x["id"], x["url"], x["title"], x["focused"]) for x in items]
    was_fresh = _open_tabs_view()["connected"]
    changed = (not was_fresh) or signature(tabs) != signature(_open_tabs["tabs"])
    _open_tabs["tabs"] = tabs
    _open_tabs["updated_at"] = time.time()
    if changed:
        await broadcast_state("TABS_UPDATED", _open_tabs_view())
    return {"status": "ok", "count": len(tabs)}


@app.get("/api/tabs/open")
async def get_open_tabs():
    return _open_tabs_view()


async def _expire_open_tabs_loop():
    """Clears the snapshot and tells the UI once the extension stops reporting."""
    while True:
        await asyncio.sleep(5)
        if _open_tabs["tabs"] and not _open_tabs_view()["connected"]:
            _open_tabs["tabs"] = []
            await broadcast_state("TABS_UPDATED", _open_tabs_view())


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


@authenticated_router.post("/api/chat")
async def handle_copilot_chat(req: ChatRequest):
    """
    DayPilot AI Copilot chat handler with automatic real-time context injection.
    Non-blocking async handler utilizing cached telemetry stores and httpx.
    """
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    lower = user_msg.lower()
    user_name = os.environ.get("USER_NAME", "Developer")
    gh_user = os.environ.get("GITHUB_USERNAME", "Developer")

    # 1. Gather live DayPilot contexts (pure in-memory non-blocking reads from sync engine cache)
    from unified_syncer import sync_engine
    current_mode = classifier.committed_mode
    active_tab = query_live_tab()
    bosscoder_data = sync_engine.bosscoder_data or []
    github_data = sync_engine.github_data or []
    emails_data = sync_engine.email_data or []

    # Format context blocks
    active_tab_str = f"{active_tab.get('window_title', 'Unknown')} ({active_tab.get('domain', 'desktop')}) [Dwell: {active_tab.get('dwell_seconds', 0)}s]"
    
    bc_str = "\n".join([f"- {b.get('title')} ({b.get('deadline')}, status: {b.get('status')})" for b in bosscoder_data[:3]]) or "None pending."
    gh_str = "\n".join([f"- {g.get('repo')} {g.get('pr')}: {g.get('title')} ({g.get('status')})" for g in github_data[:4]]) or "None pending."
    em_str = "\n".join([f"- {e.get('from')}: {e.get('subject')} -> {e.get('summary', e.get('concern', ''))}" for e in emails_data[:3]]) or "Inbox zero."

    system_prompt = f"""You are DayPilot Copilot, an AI assistant directly integrated into {user_name}'s DayPilot Flight Deck workstation on macOS.
You have real-time live access to the user's workspace telemetry, accounts, and tasks.

CURRENT USER TELEMETRY & CONTEXT:
- Developer: {user_name} (@{gh_user})
- Current Mental State Mode: [{current_mode}] (WORK / STUDY / RELAX)
- Active {DEFAULT_BROWSER} Tab: {active_tab_str}
- BossCoder Academy Progress:
{bc_str}
- Active GitHub Pull Requests:
{gh_str}
- Live Unread Emails & Executive Summaries:
{em_str}

YOUR INSTRUCTIONS:
- You are concise, sharp, technically precise, and flight-deck styled.
- You can help {user_name} write and review code, solve BossCoder DSA/Java/Web Dev problems, draft PR reviews or comments, organize the mission plan, explain errors, or transition tasks.
- If asked about current tasks, tabs, PRs, or BossCoder progress, use the live telemetry above.
- Always be helpful, actionable, and straight to the point.
"""

    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        try:
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
            
            contents = []
            for h in (req.history or []):
                role = "user" if h.role == "user" else "model"
                contents.append({"role": role, "parts": [{"text": h.content}]})
            contents.append({"role": "user", "parts": [{"text": user_msg}]})

            payload = {
                "system_instruction": {"parts": [{"text": system_prompt}]},
                "contents": contents
            }

            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    gemini_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    reply_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return {
                        "reply": reply_text,
                        "mode": current_mode,
                        "active_tab": active_tab.get("window_title", ""),
                        "source": "GEMINI_2.0_FLASH"
                    }
        except Exception:
            # Fallback if Gemini request times out or key error
            pass

    # Intelligent Local Copilot Engine (Zero-API Key Fallback)
    import re
    words = set(re.findall(r'\b\w+\b', lower))
    
    if words.intersection({"pr", "prs", "github", "pull", "pulls", "pullrequest"}):
        if github_data:
            pr_lines = [f"• **{g.get('repo')} {g.get('pr')}**: {g.get('title')} ({g.get('status')})" for g in github_data]
            reply = f"You currently have {len(github_data)} active open pull requests on GitHub:\n" + "\n".join(pr_lines) + "\n\nWould you like me to draft a response, review code changes, or test edge cases for any of these?"
        else:
            reply = "No open GitHub pull requests found in your synced repositories."
    elif words.intersection({"bosscoder", "dsa", "class", "classes", "lecture", "lectures", "curriculum", "progress", "java"}):
        if bosscoder_data:
            bc_lines = [f"• **{b.get('title')}**: {b.get('status')} ({b.get('deadline')})\n  _{b.get('concern', '')}_" for b in bosscoder_data]
            reply = "Here is your live BossCoder status:\n" + "\n".join(bc_lines) + "\n\nWould you like to review homework, walk through edge cases, or discuss the next topic?"
        else:
            reply = "Your BossCoder curriculum is currently up to date with no pending lecture alerts."
    elif words.intersection({"mail", "gmail", "email", "emails", "inbox"}):
        reply = f"Here are your latest executive email summaries:\n" + "\n".join([f"• **{e.get('from')}**: {e.get('summary', e.get('subject'))}" for e in emails_data[:3]])
    elif words.intersection({"tab", "tabs", "focus", "doing"}):
        reply = f"You are currently focused on **{active_tab.get('window_title')}** ({active_tab.get('domain')}) in mode **[{current_mode}]**. You've been on this tab for {active_tab.get('dwell_seconds')} seconds."
    elif words & {"hi", "hello", "help"}:
        pr_count = len(github_data)
        bc_count = len(bosscoder_data)
        reply = f"Greetings {user_name}. DayPilot Copilot is online and connected to your cockpit. Mode: **[{current_mode}]**.\n\nI have full live context of:\n1. Your {pr_count} active GitHub PR(s)\n2. Your BossCoder curriculum progress ({bc_count} active module(s))\n3. Your active browser tabs & executive email digests\n\nWhat would you like to tackle right now?"
    else:
        reply = f"Received: \"{user_msg}\"\n\nI'm active in your cockpit under **[{current_mode}]** mode with your live tab ({active_tab.get('domain')}), BossCoder classes, and GitHub PRs mapped.\n\n*(Tip: Add `GEMINI_API_KEY=...` to `backend/.env` for unlimited deep coding and reasoning capabilities!)*"

    return {
        "reply": reply,
        "mode": current_mode,
        "active_tab": active_tab.get("window_title", ""),
        "source": "LOCAL_FLIGHTDECK_COPILOT"
    }


@app.get("/api/tabs")
@app.get("/api/tabs/history")
def get_tabs():
    start_ts, end_ts = get_today_range()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT 
            COALESCE(window_title, app_name) as title,
            domain,
            url,
            category,
            SUM(duration_seconds) as total_seconds,
            MAX(timestamp) as last_active
        FROM activity_events
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY COALESCE(window_title, app_name), domain
        ORDER BY total_seconds DESC;
        """, (start_ts, end_ts))
        rows = cursor.fetchall()

        results = []
        for r in rows:
            secs = r["total_seconds"] or 0
            hrs = secs // 3600
            mins = (secs % 3600) // 60
            time_str = f"{hrs}h {mins}m" if hrs > 0 else f"{mins}m {secs % 60}s"

            results.append({
                "title": r["title"] or "Untitled Tab",
                "domain": r["domain"] or "local",
                "url": r["url"] or "",
                "category": r["category"] or "WORK",
                "total_seconds": secs,
                "formatted_time": time_str,
                "last_active": r["last_active"]
            })
        return results
    finally:
        conn.close()


@app.get("/api/timeline")
def get_timeline():
    from history_syncer import sync_opera_gx_activity
    try:
        sync_opera_gx_activity(limit_hours=24)
    except Exception:
        pass

    start_ts, end_ts = get_today_range()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT timestamp, app_name, window_title, category, duration_seconds
        FROM activity_events
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC;
        """, (start_ts, end_ts))
        rows = cursor.fetchall()

        if not rows:
            return []

        # Merge consecutive heartbeats with the same category into real continuous sessions
        sessions = []
        current_session = None

        for row in rows:
            try:
                ts = datetime.fromisoformat(row["timestamp"])
                label = row["window_title"] or row["app_name"] or "Activity"
                cat = row["category"] or "WORK"
                if cat == "RELAX" and any(k in label.lower() for k in ["chapter", "manhwa", "manga", "toon"]):
                    cat = "MANHWA"
                elif cat == "RELAX" and any(k in label.lower() for k in ["episode", "season", "netflix", "crunchyroll"]):
                    cat = "SHOWS"

                dur_sec = max(5, row["duration_seconds"] or 5)
                row_start = ts
                row_end = datetime.fromtimestamp(ts.timestamp() + dur_sec)

                if current_session is None:
                    current_session = {
                        "category": cat,
                        "label": label[:45],
                        "start_dt": row_start,
                        "end_dt": row_end,
                        "total_seconds": dur_sec,
                        "title_counts": {label: 1}
                    }
                else:
                    gap_seconds = (row_start - current_session["end_dt"]).total_seconds()
                    # Merge if same category and gap <= 15 minutes (900s)
                    if cat == current_session["category"] and gap_seconds <= 900:
                        current_session["end_dt"] = max(current_session["end_dt"], row_end)
                        current_session["total_seconds"] += dur_sec
                        current_session["title_counts"][label] = current_session["title_counts"].get(label, 0) + 1
                    else:
                        sessions.append(current_session)
                        current_session = {
                            "category": cat,
                            "label": label[:45],
                            "start_dt": row_start,
                            "end_dt": row_end,
                            "total_seconds": dur_sec,
                            "title_counts": {label: 1}
                        }
            except Exception:
                continue

        if current_session:
            sessions.append(current_session)

        # Build dial segments from merged real sessions
        segments = []
        for s in sessions:
            start_hour = s["start_dt"].hour + (s["start_dt"].minute / 60.0) + (s["start_dt"].second / 3600.0)
            end_hour = s["end_dt"].hour + (s["end_dt"].minute / 60.0) + (s["end_dt"].second / 3600.0)
            if end_hour - start_hour < 0.17:  # minimum 10m visual thickness on 24h dial
                end_hour = min(24.0, start_hour + 0.17)

            primary_label = max(s["title_counts"].items(), key=lambda x: x[1])[0]
            mins = int(s["total_seconds"] // 60)
            hrs = mins // 60
            rem_m = mins % 60
            dur_str = f"{hrs}h {rem_m}m" if hrs > 0 else f"{mins}m"

            segments.append({
                "startHour": round(start_hour, 2),
                "endHour": round(end_hour, 2),
                "category": s["category"],
                "label": primary_label[:45],
                "duration": dur_str
            })

        return segments
    finally:
        conn.close()


@app.get("/api/briefing/morning")
def get_morning_briefing():
    from unified_syncer import sync_engine
    return sync_engine.get_cached_briefing()


@app.get("/api/news")
async def get_news(topic: Optional[str] = None, limit: int = 20):
    from collectors.newspaper import get_news_payload
    limit = max(1, min(limit, 50))
    return await asyncio.to_thread(get_news_payload, topic, limit)


@authenticated_router.post("/api/news/refresh")
async def refresh_news_now():
    from collectors.newspaper import refresh_news, get_news_payload
    report = await refresh_news()
    payload = await asyncio.to_thread(get_news_payload, None, 20)
    if not report.get("throttled"):
        await broadcast_state("NEWS_UPDATED", {"new": report["new"]})
    return {**payload, "refresh": report}


@authenticated_router.post("/api/sync/all")
async def sync_all_connected_services():
    from unified_syncer import sync_engine
    report = await sync_engine.sync_all_now()
    return report


@app.get("/api/spectrogram")
def get_spectrogram():
    from collectors.spectrogram import generate_24h_spectrogram
    start_ts, end_ts = get_today_range()
    return generate_24h_spectrogram(start_ts, end_ts)


@app.get("/api/briefing/nightly")
def get_nightly_briefing():
    from collectors.spectrogram import generate_24h_spectrogram, audit_planned_vs_completed
    from unified_syncer import sync_engine
    from history_syncer import sync_opera_gx_activity

    try:
        sync_opera_gx_activity(limit_hours=24)
    except Exception:
        pass

    start_ts, end_ts = get_today_range()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Query today's totals using indexed timestamp range
        cursor.execute("""
        SELECT category, SUM(duration_seconds) as total_seconds
        FROM activity_events
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY category;
        """, (start_ts, end_ts))
        totals = {row["category"]: row["total_seconds"] for row in cursor.fetchall()}

        # Query bookmarks
        cursor.execute("SELECT * FROM media_bookmarks ORDER BY last_updated DESC LIMIT 50;")
        bookmarks = [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()

    total_work = totals.get("WORK", 0) + totals.get("STUDY", 0)
    total_relax = totals.get("RELAX", 0) + totals.get("LEISURE", 0)
    total_active = total_work + total_relax

    # Calculate dynamic focus score strictly from empirical activity events
    focus_score = min(100, max(0, round((total_work / total_active) * 100))) if total_active > 0 else 0

    # 48-slot continuous spectrogram based on empirical activity distribution
    spectrogram_slots = generate_24h_spectrogram(start_ts, end_ts)

    # Real audit of planned commitments vs actual completed telemetry
    cached_briefing = sync_engine.get_cached_briefing()
    flight_log = audit_planned_vs_completed(
        start_ts,
        end_ts,
        cached_briefing.get("schedule_blocks", []),
        cached_briefing.get("calendar_events", [])
    )

    work_hrs = round(total_work / 3600, 1)
    relax_hrs = round(total_relax / 3600, 1)
    completed_tasks = sum(1 for f in flight_log if f.get("status") == "COMPLETED")
    total_tasks = sum(1 for f in flight_log if f.get("type") in ("PLANNED", "CALENDAR"))

    if total_active > 0:
        ai_summary = (
            f"Daily Flight Debrief: Logged {work_hrs}h productive flow (WORK/STUDY) and {relax_hrs}h rest/leisure "
            f"with an overall focus score of {focus_score}%. Resolved {completed_tasks}/{max(1, total_tasks)} scheduled flight commitments."
        )
    else:
        ai_summary = "Daily Flight Debrief: No activity recorded yet today. DayPilot workstation ready for telemetry ingestion."

    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "focus_score": focus_score,
        "is_demo_data": False,
        "total_work_seconds": total_work,
        "total_relax_seconds": total_relax,
        "total_work_hours": work_hrs,
        "total_relax_hours": relax_hrs,
        "category_totals": totals,
        "bookmarks": bookmarks,
        "flight_log": flight_log,
        "spectrogram": spectrogram_slots,
        "ai_summary": ai_summary
    }


@app.get("/api/context")
def get_context():
    return {
        "mode": classifier.committed_mode,
        "override": classifier.manual_override,
        "pending_mode": classifier.pending_mode,
        "timestamp": time.time()
    }


@authenticated_router.post("/api/context/override")
async def set_override(payload: OverridePayload):
    new_mode = classifier.set_manual_override(payload.mode)
    await broadcast_state("MODE_CHANGE", {
        "mode": new_mode,
        "override": payload.mode,
        "reason": "MANUAL_OVERRIDE"
    })
    return {"status": "ok", "mode": new_mode, "override": payload.mode}


@authenticated_router.post("/api/heartbeat")
async def ingest_heartbeat(payload: HeartbeatPayload):
    # Process through context classifier
    current_mode, mode_changed = classifier.process_heartbeat(
        app_name=payload.app_name,
        domain=payload.domain,
        title=payload.window_title,
        duration_seconds=payload.duration_seconds,
        idle_seconds=payload.idle_seconds
    )

    # Ingest into SQLite database if non-idle, or if in a meeting/video call
    is_meeting = (
        "zoom" in (payload.domain or "").lower() or "zoom" in (payload.window_title or "").lower() or
        "meet.google.com" in (payload.domain or "").lower() or "teams" in (payload.domain or "").lower()
    )
    if is_meeting or payload.idle_seconds <= classifier.idle_timeout:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO activity_events (app_name, window_title, domain, url, category, duration_seconds)
            VALUES (?, ?, ?, ?, ?, ?);
            """, (
                payload.app_name,
                payload.window_title,
                payload.domain,
                payload.url,
                current_mode,
                payload.duration_seconds
            ))
            conn.commit()
        finally:
            conn.close()

    # Parse and upsert media bookmark if detected
    media_info = parse_media_info(
        window_title=payload.window_title,
        domain=payload.domain,
        url=payload.url,
        explicit_media_type=payload.media_type,
        explicit_series_title=payload.series_title,
        explicit_unit_label=payload.unit_label,
        timestamp_offset=payload.timestamp_offset
    )
    if media_info:
        upsert_bookmark(
            media_type=media_info["media_type"],
            title=media_info["title"],
            current_unit=media_info["current_unit"],
            resume_url=media_info["resume_url"],
            timestamp_offset=media_info.get("timestamp_offset")
        )

    if mode_changed:
        await broadcast_state("MODE_CHANGE", {
            "mode": current_mode,
            "override": classifier.manual_override,
            "reason": "AUTO_CLASSIFIER_HYSTERESIS"
        })

    return {"status": "ok", "mode": current_mode}


@app.get("/api/bookmarks")
def get_bookmarks():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM media_bookmarks ORDER BY last_updated DESC LIMIT 50;")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/memos")
def get_memos():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        id,
        recorded_at,
        file_path,
        duration_seconds,
        transcription,
        action_item
    FROM voice_memos
    ORDER BY recorded_at DESC
    LIMIT 30;
    """)
    rows = cursor.fetchall()
    conn.close()

    memos = []
    for r in rows:
        recorded = str(r["recorded_at"])
        time_part = recorded.split(" ")[1][:5] if " " in recorded else recorded
        memos.append({
            "id": r["id"],
            "time": time_part,
            "text": r["transcription"] or "Voice note recorded.",
            "action": r["action_item"] or "Review note",
            "duration": r["duration_seconds"] or 0
        })
    return memos


@authenticated_router.post("/api/memos/upload")
async def upload_memo(
    file: Optional[UploadFile] = File(None),
    duration: float = Form(0.0),
    transcript: Optional[str] = Form(None)
):
    memos_dir = Path.home() / "daypilot" / "memos"
    memos_dir.mkdir(parents=True, exist_ok=True)

    dest_path = ""
    if file:
        ext = ".webm" if "webm" in (file.filename or "") else ".mp4"
        filename = f"memo_{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
        dest_path = str(memos_dir / filename)
        content = await file.read()
        with open(dest_path, "wb") as f:
            f.write(content)

    # Use client-provided speech recognition transcript or intelligent fallback
    final_transcript = (transcript or "").strip()
    if not final_transcript:
        final_transcript = "Audio memo captured: Review BossCoder curriculum and ongoing GitHub pull requests."
        action_item = "Review curriculum & PRs"
    else:
        # Extract concise action item (first clause or short summary)
        action_item = final_transcript.split(".")[0][:45] if "." in final_transcript else final_transcript[:45]

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO voice_memos (file_path, duration_seconds, transcription, action_item)
    VALUES (?, ?, ?, ?);
    """, (dest_path, duration, final_transcript, action_item))
    conn.commit()
    inserted_id = cursor.lastrowid
    conn.close()

    return {
        "status": "ok",
        "id": inserted_id,
        "file": dest_path,
        "transcription": final_transcript,
        "action_item": action_item,
        "time": datetime.now().strftime("%I:%M %p")
    }


@app.get("/api/music/suggest")
def get_music_suggestion():
    from music.preference_engine import get_preferred_cluster_for_activity
    mode = classifier.committed_mode
    return get_preferred_cluster_for_activity(mode)


@authenticated_router.post("/api/bookmarks/sync-history")
async def trigger_history_sync():
    from history_syncer import sync_opera_gx_history
    count = sync_opera_gx_history()
    await broadcast_state("BOOKMARKS_UPDATED", {"synced_count": count})
    return {"status": "ok", "synced_count": count}


@authenticated_router.post("/api/open-url")
def open_system_url(payload: Dict[str, Any]):
    url = payload.get("url", "")
    if url and (url.startswith("http://") or url.startswith("https://")):
        import subprocess
        try:
            # Configurable browser setting (default: Opera GX)
            res = subprocess.run(["open", "-a", DEFAULT_BROWSER, url], capture_output=True)
            if res.returncode == 0:
                return {"status": "ok", "url": url, "browser": DEFAULT_BROWSER}
            # Fallback to system open
            subprocess.Popen(["open", url])
            return {"status": "ok", "url": url, "browser": "default"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    return {"status": "invalid_url"}


# Register authenticated router protecting all state-changing endpoints
app.include_router(authenticated_router)
