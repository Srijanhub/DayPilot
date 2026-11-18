"""
DayPilot Database Engine
SQLite with Write-Ahead Logging (WAL) mode for local concurrent telemetry ingestion.
"""

import os
import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

# Base data directory in user home or local path
DATA_DIR = Path.home() / "daypilot" / "data"
DB_PATH = DATA_DIR / "activity.db"


def get_db_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for high concurrency
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    # Activity Events table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        app_name TEXT NOT NULL,
        window_title TEXT,
        domain TEXT,
        url TEXT,
        category TEXT CHECK(category IN ('WORK', 'STUDY', 'RELAX', 'LEISURE', 'IDLE')),
        duration_seconds INTEGER NOT NULL
    );
    """)

    # Media Bookmarks table ("Where I Left Off")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS media_bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_type TEXT CHECK(media_type IN ('MANHWA', 'MANGA', 'SHOW', 'ANIME')),
        title TEXT NOT NULL UNIQUE,
        current_unit TEXT NOT NULL,
        timestamp_offset TEXT,
        resume_url TEXT NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Voice Memos table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS voice_memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        file_path TEXT NOT NULL,
        duration_seconds REAL,
        transcription TEXT,
        action_item TEXT
    );
    """)

    # Daily Audits table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_audits (
        date DATE PRIMARY KEY,
        planned_tasks TEXT NOT NULL,
        completed_tasks TEXT,
        carried_over_tasks TEXT,
        total_work_seconds INTEGER DEFAULT 0,
        total_study_seconds INTEGER DEFAULT 0,
        total_relax_seconds INTEGER DEFAULT 0,
        ai_summary TEXT
    );
    """)

    # Music Preferences table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS music_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT,
        track_name TEXT NOT NULL,
        artist TEXT,
        genre TEXT,
        activity_state TEXT CHECK(activity_state IN ('WORK', 'STUDY', 'RELAX')),
        dwell_seconds INTEGER NOT NULL,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_events(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_media_bookmarks_title ON media_bookmarks(title);")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print("Database initialized at:", DB_PATH)
