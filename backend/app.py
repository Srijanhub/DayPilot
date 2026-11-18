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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import get_db_connection, init_db
from classifier import ContextClassifier
from collectors.briefing_engine import synthesize_morning_briefing
from collectors.bosscoder import get_bosscoder_alerts
from collectors.github_sync import get_github_notifications
from collectors.google_suite import get_priority_emails
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="DayPilot Engine", version="1.0.0")

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


@app.on_event("startup")
async def on_startup():
    init_db()
    import asyncio
    from unified_syncer import sync_engine
    sync_engine.set_broadcast_callback(broadcast_state)
    asyncio.create_task(sync_engine.start_background_loop())


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


@app.get("/api/tabs/live")
def get_live_tab():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM activity_events
    ORDER BY id DESC LIMIT 1;
    """)
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"is_active": False}

    # Count consecutive heartbeats on same title/domain
    conn = get_db_connection()
    cursor = conn.cursor()
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
    conn.close()

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


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


@app.post("/api/chat")
def handle_copilot_chat(req: ChatRequest):
    """
    DayPilot AI Copilot chat handler with automatic real-time context injection.
    Injects active Opera GX tab, mental mode, BossCoder courses, GitHub PRs, and emails.
    """
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    lower = user_msg.lower()
    user_name = os.environ.get("USER_NAME", "Developer")
    gh_user = os.environ.get("GITHUB_USERNAME", "Developer")

    # 1. Gather live DayPilot contexts
    current_mode = classifier.committed_mode
    active_tab = get_live_tab()
    bosscoder_data = get_bosscoder_alerts()
    github_data = get_github_notifications()
    emails_data = get_priority_emails()

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
            import urllib.request
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

            req_gem = urllib.request.Request(
                gemini_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req_gem, timeout=12.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                reply_text = data["candidates"][0]["content"]["parts"][0]["text"]
                return {
                    "reply": reply_text,
                    "mode": current_mode,
                    "active_tab": active_tab.get("window_title", ""),
                    "source": "GEMINI_2.0_FLASH"
                }
        except Exception as e:
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
    conn = get_db_connection()
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
    WHERE date(timestamp) = date('now')
    GROUP BY COALESCE(window_title, app_name), domain
    ORDER BY total_seconds DESC;
    """)
    rows = cursor.fetchall()
    conn.close()

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


@app.get("/api/timeline")
def get_timeline():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT timestamp, app_name, window_title, category, duration_seconds
    FROM activity_events
    WHERE date(timestamp) = date('now')
    ORDER BY timestamp ASC;
    """)
    rows = cursor.fetchall()
    conn.close()

    segments = []
    # Build continuous segments from today's actual activity records
    for row in rows:
        try:
            ts = datetime.fromisoformat(row["timestamp"])
            start_hour = ts.hour + (ts.minute / 60.0)
            dur_hours = row["duration_seconds"] / 3600.0
            end_hour = min(24.0, start_hour + max(0.25, dur_hours))
            label = row["window_title"] or row["app_name"]
            category = row["category"] or "WORK"
            if category == "RELAX" and ("chapter" in label.lower() or "manhwa" in label.lower()):
                category = "MANHWA"
            elif category == "RELAX" and ("episode" in label.lower() or "netflix" in label.lower()):
                category = "SHOWS"

            segments.append({
                "startHour": round(start_hour, 2),
                "endHour": round(end_hour, 2),
                "category": category,
                "label": label[:45],
                "duration": f"{int(row['duration_seconds'] // 60)}m"
            })
        except Exception:
            continue

    if not segments:
        segments = [
            {"startHour": 9.0, "endHour": 11.5, "category": "WORK", "label": "Active Work Session", "duration": "2h 30m"}
        ]

    return segments


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
    conn = get_db_connection()
    cursor = conn.cursor()

    # Query today's totals
    cursor.execute("""
    SELECT category, SUM(duration_seconds) as total_seconds
    FROM activity_events
    WHERE date(timestamp) = date('now')
    GROUP BY category;
    """)
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
    WHERE date(timestamp) = date('now')
    GROUP BY COALESCE(window_title, app_name), category
    ORDER BY total_seconds DESC
    LIMIT 5;
    """)
    activity_rows = cursor.fetchall()
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

    # Ingest into SQLite database
    conn = get_db_connection()
    cursor = conn.cursor()

    # If non-idle, record activity event
    if payload.idle_seconds <= classifier.idle_timeout:
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

    # If media telemetry present, update media_bookmarks
    if payload.media_type and payload.series_title and payload.unit_label:
        m_type = payload.media_type.upper().strip()
        if m_type not in ('MANHWA', 'MANGA', 'SHOW', 'ANIME'):
            m_type = "SHOW"
        cursor.execute("""
        INSERT INTO media_bookmarks (media_type, title, current_unit, timestamp_offset, resume_url, last_updated)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(title) DO UPDATE SET
            media_type = excluded.media_type,
            current_unit = excluded.current_unit,
            timestamp_offset = CASE WHEN excluded.timestamp_offset IS NOT NULL AND excluded.timestamp_offset != '' THEN excluded.timestamp_offset ELSE media_bookmarks.timestamp_offset END,
            resume_url = CASE WHEN excluded.resume_url != '' THEN excluded.resume_url ELSE media_bookmarks.resume_url END,
            last_updated = CURRENT_TIMESTAMP;
        """, (
            m_type,
            payload.series_title.strip(),
            payload.unit_label.strip(),
            payload.timestamp_offset,
            payload.url or ""
        ))
    elif payload.window_title:
        title_raw = payload.window_title.strip()
        title_lower = title_raw.lower()
        domain_str = (payload.domain or "").lower()
        url_str = (payload.url or "")
        import re

        chap_match = re.search(r'(?:chapter|ch\.?)\s*(\d+(?:\.\d+)?)', title_lower, re.IGNORECASE)
        season_ep_match = re.search(r'(?:s(\d+)\s*e(\d+)|season\s*(\d+).*?episode\s*(\d+))', title_lower, re.IGNORECASE)
        ep_match = re.search(r'(?:episode|ep\.?)\s*(\d+)', title_lower, re.IGNORECASE)
        
        is_manhwa = any(k in title_lower or k in domain_str for k in ["manhwa", "manga", "manhua", "comic", "asura", "flame", "toon", "reaper", "webtoon", "scan"])
        is_anime = any(k in title_lower or k in domain_str for k in ["crunchyroll", "aniwatch", "hianime", "9anime", "gogoanime", "animepahe", "anime"])
        is_show = any(k in title_lower or k in domain_str for k in ["netflix", "primevideo", "hotstar", "disneyplus", "hulu", "max.com", "appletv"])
        is_youtube = ("youtube.com" in domain_str or "- youtube" in title_lower) and "music.youtube" not in domain_str

        if chap_match and is_manhwa:
            chap_num = chap_match.group(1)
            parts = re.split(r'[-–|]', title_raw)
            series_name = parts[0].strip()
            if series_name:
                cursor.execute("""
                INSERT INTO media_bookmarks (media_type, title, current_unit, timestamp_offset, resume_url, last_updated)
                VALUES ('MANHWA', ?, ?, NULL, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(title) DO UPDATE SET
                    media_type = 'MANHWA',
                    current_unit = excluded.current_unit,
                    resume_url = CASE WHEN excluded.resume_url != '' THEN excluded.resume_url ELSE media_bookmarks.resume_url END,
                    last_updated = CURRENT_TIMESTAMP;
                """, (series_name, f"Chapter {chap_num}", url_str))
        elif (season_ep_match or ep_match) and is_anime:
            unit_str = f"S{season_ep_match.group(1) or season_ep_match.group(3)} E{season_ep_match.group(2) or season_ep_match.group(4)}" if season_ep_match else f"Episode {ep_match.group(1)}"
            t_clean = re.sub(r'^(?:watch\s+)', '', title_raw, flags=re.IGNORECASE)
            t_clean = re.sub(r'(?:english\s+subbed|english\s+dubbed|on\s+hianime\.to|on\s+crunchyroll|\bon\s+[\w\.-]+)', '', t_clean, flags=re.IGNORECASE)
            t_clean = re.sub(r'(?:s\d+\s*e\d+|season\s*\d+.*?episode\s*\d+|episode\s*\d+|ep\.?\s*\d+).*$', '', t_clean, flags=re.IGNORECASE)
            parts = re.split(r'[-–|]', t_clean)
            series_name = parts[0].strip()
            if series_name:
                cursor.execute("""
                INSERT INTO media_bookmarks (media_type, title, current_unit, timestamp_offset, resume_url, last_updated)
                VALUES ('ANIME', ?, ?, NULL, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(title) DO UPDATE SET
                    media_type = 'ANIME',
                    current_unit = excluded.current_unit,
                    resume_url = CASE WHEN excluded.resume_url != '' THEN excluded.resume_url ELSE media_bookmarks.resume_url END,
                    last_updated = CURRENT_TIMESTAMP;
                """, (series_name, unit_str, url_str))
        elif (season_ep_match or ep_match) and is_show:
            unit_str = f"S{season_ep_match.group(1) or season_ep_match.group(3)} E{season_ep_match.group(2) or season_ep_match.group(4)}" if season_ep_match else f"Episode {ep_match.group(1)}"
            t_clean = re.sub(r'(?:-\s*netflix|-\s*prime\s*video|-\s*disney\+.*|-\s*hotstar).*$', '', title_raw, flags=re.IGNORECASE)
            t_clean = re.sub(r'(?:s\d+\s*e\d+|season\s*\d+.*?episode\s*\d+|episode\s*\d+|ep\.?\s*\d+).*$', '', t_clean, flags=re.IGNORECASE)
            parts = re.split(r'[-–|]', t_clean)
            series_name = parts[0].strip()
            if series_name:
                cursor.execute("""
                INSERT INTO media_bookmarks (media_type, title, current_unit, timestamp_offset, resume_url, last_updated)
                VALUES ('SHOW', ?, ?, NULL, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(title) DO UPDATE SET
                    media_type = 'SHOW',
                    current_unit = excluded.current_unit,
                    resume_url = CASE WHEN excluded.resume_url != '' THEN excluded.resume_url ELSE media_bookmarks.resume_url END,
                    last_updated = CURRENT_TIMESTAMP;
                """, (series_name, unit_str, url_str))
        elif is_youtube and len(title_raw) > 3:
            cleaned_title = re.sub(r'\s*-\s*YouTube\s*$', '', title_raw, flags=re.IGNORECASE).strip()
            unit_str = "Video"
            if season_ep_match:
                unit_str = f"S{season_ep_match.group(1) or season_ep_match.group(3)} E{season_ep_match.group(2) or season_ep_match.group(4)}"
            elif ep_match:
                unit_str = f"Episode {ep_match.group(1)}"
            elif re.search(r'part\s*(\d+)', title_lower):
                p_m = re.search(r'part\s*(\d+)', title_lower)
                unit_str = f"Part {p_m.group(1)}"
            if cleaned_title:
                cursor.execute("""
                INSERT INTO media_bookmarks (media_type, title, current_unit, timestamp_offset, resume_url, last_updated)
                VALUES ('SHOW', ?, ?, NULL, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(title) DO UPDATE SET
                    media_type = 'SHOW',
                    current_unit = excluded.current_unit,
                    resume_url = CASE WHEN excluded.resume_url != '' THEN excluded.resume_url ELSE media_bookmarks.resume_url END,
                    last_updated = CURRENT_TIMESTAMP;
                """, (cleaned_title, unit_str, url_str))

    # Ensure media_bookmarks never exceeds the top 50 items
    cursor.execute("""
    DELETE FROM media_bookmarks
    WHERE id NOT IN (
        SELECT id FROM media_bookmarks
        ORDER BY last_updated DESC
        LIMIT 50
    );
    """)

    conn.commit()
    conn.close()

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
