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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import get_db_connection, init_db, get_today_range, upsert_bookmark, prune_media_bookmarks
from media_parser import parse_media_info
from classifier import ContextClassifier
from collectors.briefing_engine import synthesize_morning_briefing
from collectors.bosscoder import get_bosscoder_alerts
from collectors.github_sync import get_github_notifications
from collectors.google_suite import get_priority_emails
from dotenv import load_dotenv

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Modern lifespan handler (replaces deprecated @app.on_event("startup"))
    init_db()
    from unified_syncer import sync_engine
    sync_engine.set_broadcast_callback(broadcast_state)
    sync_task = asyncio.create_task(sync_engine.start_background_loop())
    yield
    sync_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="DayPilot Engine", version="1.0.0", lifespan=lifespan)

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

DAYPILOT_API_TOKEN = os.environ.get("DAYPILOT_API_TOKEN", "daypilot_local_sec_994b7a2d")


def verify_daypilot_token(x_daypilot_token: Optional[str] = Header(None, alias="X-DayPilot-Token")):
    if not x_daypilot_token or x_daypilot_token != DAYPILOT_API_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized: invalid or missing X-DayPilot-Token")

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


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


@app.post("/api/chat")
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

    # 1. Gather live DayPilot contexts (non-blocking from sync engine cache)
    from unified_syncer import sync_engine
    current_mode = classifier.committed_mode
    active_tab = query_live_tab()
    bosscoder_data = sync_engine.bosscoder_data or get_bosscoder_alerts()
    github_data = sync_engine.github_data or get_github_notifications()
    emails_data = sync_engine.email_data or get_priority_emails()

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
- Active Opera GX Tab: {active_tab_str}
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
    elif "mail" in lower or "gmail" in lower or "email" in lower:
        reply = f"Here are your latest executive email summaries:\n" + "\n".join([f"• **{e.get('from')}**: {e.get('summary', e.get('subject'))}" for e in emails_data[:3]])
    elif "tab" in lower or "focus" in lower or "doing" in lower:
        reply = f"You are currently focused on **{active_tab.get('window_title')}** ({active_tab.get('domain')}) in mode **[{current_mode}]**. You've been on this tab for {active_tab.get('dwell_seconds')} seconds."
    elif "help" in lower or "hi" in lower or "hello" in lower:
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


@app.post("/api/sync/all")
async def sync_all_connected_services():
    from unified_syncer import sync_engine
    report = await sync_engine.sync_all_now()
    return report


@app.get("/api/briefing/nightly")
def get_nightly_briefing():
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

        # Query today's top activities for dynamic flight log
        cursor.execute("""
        SELECT 
            COALESCE(window_title, app_name) as title,
            category,
            SUM(duration_seconds) as total_seconds,
            MAX(timestamp) as last_seen
        FROM activity_events
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY COALESCE(window_title, app_name), category
        ORDER BY total_seconds DESC
        LIMIT 5;
        """, (start_ts, end_ts))
        activity_rows = cursor.fetchall()
    finally:
        conn.close()

    total_work = totals.get("WORK", 0) + totals.get("STUDY", 0)
    total_relax = totals.get("RELAX", 0) + totals.get("LEISURE", 0)
    total_active = total_work + total_relax

    # Calculate dynamic focus score from empirical activity events
    focus_score = min(100, max(0, round((total_work / total_active) * 100))) if total_active > 0 else 0

    flight_log = []
    for act in activity_rows:
        secs = act["total_seconds"] or 0
        mins = secs // 60
        cat = act["category"] or "WORK"
        status = "COMPLETED" if cat in ("WORK", "STUDY") else "LEISURE"
        last_seen_str = str(act["last_seen"])
        time_part = last_seen_str.split(" ")[1][:5] if " " in last_seen_str else last_seen_str
        flight_log.append({
            "title": f"{act['title']} ({mins}m)",
            "status": status,
            "time": time_part
        })

    if not flight_log:
        flight_log = [
            {"title": "DayPilot Workstation Calibration", "status": "COMPLETED", "time": datetime.now().strftime("%I:%M %p")}
        ]

    work_hrs = round(total_work / 3600, 1)
    relax_hrs = round(total_relax / 3600, 1)
    ai_summary = f"Daily Flight Debrief: Logged {work_hrs}h productive flow (WORK/STUDY) and {relax_hrs}h rest/leisure with an overall focus score of {focus_score}%."

    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "focus_score": focus_score,
        "is_demo_data": False,
        "total_work_seconds": total_work,
        "total_relax_seconds": total_relax,
        "category_totals": totals,
        "bookmarks": bookmarks,
        "flight_log": flight_log,
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


@app.post("/api/context/override")
async def set_override(payload: OverridePayload):
    new_mode = classifier.set_manual_override(payload.mode)
    await broadcast_state("MODE_CHANGE", {
        "mode": new_mode,
        "override": payload.mode,
        "reason": "MANUAL_OVERRIDE"
    })
    return {"status": "ok", "mode": new_mode, "override": payload.mode}


@app.post("/api/heartbeat")
async def ingest_heartbeat(payload: HeartbeatPayload):
    # Process through context classifier
    current_mode, mode_changed = classifier.process_heartbeat(
        app_name=payload.app_name,
        domain=payload.domain,
        title=payload.window_title,
        duration_seconds=payload.duration_seconds,
        idle_seconds=payload.idle_seconds
    )

    # Ingest into SQLite database if non-idle
    if payload.idle_seconds <= classifier.idle_timeout:
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


@app.post("/api/memos/upload")
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


@app.post("/api/bookmarks/sync-history")
async def trigger_history_sync():
    from history_syncer import sync_opera_gx_history
    count = sync_opera_gx_history()
    await broadcast_state("BOOKMARKS_UPDATED", {"synced_count": count})
    return {"status": "ok", "synced_count": count}


@app.post("/api/open-url", dependencies=[Depends(verify_daypilot_token)])
def open_system_url(payload: Dict[str, Any]):
    url = payload.get("url", "")
    if url and (url.startswith("http://") or url.startswith("https://")):
        import subprocess
        try:
            # Default browser for DayPilot is explicitly Opera GX
            res = subprocess.run(["open", "-a", "Opera GX", url], capture_output=True)
            if res.returncode == 0:
                return {"status": "ok", "url": url, "browser": "Opera GX"}
            # Fallback to system open
            subprocess.Popen(["open", url])
            return {"status": "ok", "url": url, "browser": "default"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    return {"status": "invalid_url"}
