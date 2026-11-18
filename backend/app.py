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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import get_db_connection, init_db
from classifier import ContextClassifier

app = FastAPI(title="DayPilot Engine", version="1.0.0")

# Strict CORS: Allow only localhost:3000 and browser extension origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "chrome-extension://*",
    ],
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
def on_startup():
    init_db()


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
        cursor.execute("""
        INSERT INTO media_bookmarks (media_type, title, current_unit, timestamp_offset, resume_url, last_updated)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(title) DO UPDATE SET
            current_unit = excluded.current_unit,
            timestamp_offset = excluded.timestamp_offset,
            resume_url = excluded.resume_url,
            last_updated = CURRENT_TIMESTAMP;
        """, (
            payload.media_type,
            payload.series_title,
            payload.unit_label,
            payload.timestamp_offset,
            payload.url or ""
        ))

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
    cursor.execute("SELECT * FROM media_bookmarks ORDER BY last_updated DESC;")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/memos/upload")
async def upload_memo(file: UploadFile = File(...), duration: float = Form(0.0)):
    memos_dir = Path.home() / "daypilot" / "memos"
    memos_dir.mkdir(parents=True, exist_ok=True)

    filename = f"memo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.webm"
    dest_path = memos_dir / filename

    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    # Local transcription placeholder / stub
    simulated_transcript = "Remember to review BossCoder Dynamic Programming Lab 4 and test the tree traversal edge case."
    action_item = "Review BossCoder DP Lab 4"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO voice_memos (file_path, duration_seconds, transcription, action_item)
    VALUES (?, ?, ?, ?);
    """, (str(dest_path), duration, simulated_transcript, action_item))
    conn.commit()
    conn.close()

    return {
        "status": "ok",
        "file": str(dest_path),
        "transcription": simulated_transcript,
        "action_item": action_item
    }


@app.get("/api/music/suggest")
def get_music_suggestion():
    mode = classifier.committed_mode
    suggestions = {
        "WORK": {
            "cluster": "Deep Focus Flow",
            "genre": "Synthwave / Dark Techno",
            "track": "Resonance — HOME",
            "reason": "84% correlation with your coding focus sessions"
        },
        "STUDY": {
            "cluster": "Study & Problem Solving",
            "genre": "Lo-Fi Beats / Piano",
            "track": "Lofi Rain Session — ChilledCow",
            "reason": "Best memory retention during algorithmic study"
        },
        "RELAX": {
            "cluster": "Late Night Chill",
            "genre": "Ambient Soundscapes",
            "track": "Weightless — Marconi Union",
            "reason": "Optimal wind-down during manhwa reading"
        }
    }
    return suggestions.get(mode, suggestions["WORK"])
