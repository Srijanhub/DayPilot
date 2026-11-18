"""
Unit tests for DayPilot 24-Hour Spectrogram & Retrospective Engine
"""

import pytest
from datetime import datetime, date
import database
from collectors.spectrogram import (
    classify_activity_category,
    generate_24h_spectrogram,
    audit_planned_vs_completed
)


@pytest.fixture(autouse=True)
def setup_tmp_db(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DATA_DIR", tmp_path)
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test_act.db")
    database.init_db()
    yield


def test_classify_activity_category():
    assert classify_activity_category("The Greatest Estate Developer - Chapter 148", "WORK") == "MANHWA"
    assert classify_activity_category("Netflix - Arcane: Season 2 (Episode 4)", "WORK") == "SHOWS"
    assert classify_activity_category("Crunchyroll - Jujutsu Kaisen", "RELAX") == "SHOWS"
    assert classify_activity_category("VS Code - daypilot/app.py", "WORK") == "WORK"
    assert classify_activity_category("BossCoder Academy Lecture", "STUDY") == "STUDY"


def test_generate_24h_spectrogram_empty():
    today = date.today().isoformat()
    start_ts = f"{today} 00:00:00"
    end_ts = f"{today} 23:59:59"

    slots = generate_24h_spectrogram(start_ts, end_ts)
    assert len(slots) == 48
    assert all(s["active_seconds"] == 0 for s in slots)
    assert all(s["category"] == "IDLE" for s in slots)
    assert all(s["height"] == 10 for s in slots)


def test_generate_24h_spectrogram_with_events():
    conn = database.get_db_connection()
    today = date.today().isoformat()
    try:
        cur = conn.cursor()
        # Insert a 45-minute event from 10:00 to 10:45
        cur.execute("""
            INSERT INTO activity_events (timestamp, app_name, window_title, category, duration_seconds)
            VALUES (?, ?, ?, ?, ?);
        """, (f"{today} 10:00:00", "VS Code", "DayPilot Project", "WORK", 2700))
        conn.commit()
    finally:
        conn.close()

    start_ts = f"{today} 00:00:00"
    end_ts = f"{today} 23:59:59"

    slots = generate_24h_spectrogram(start_ts, end_ts)
    assert len(slots) == 48

    # Slot 20 is 10:00 - 10:30 (full 1800s active -> 100% intensity)
    slot_10_00 = slots[20]
    assert slot_10_00["time"] == "10:00"
    assert slot_10_00["category"] == "WORK"
    assert slot_10_00["active_minutes"] == 30.0
    assert slot_10_00["intensity"] == 100
    assert slot_10_00["height"] == 100

    # Slot 21 is 10:30 - 11:00 (15 minutes active -> 50% intensity)
    slot_10_30 = slots[21]
    assert slot_10_30["time"] == "10:30"
    assert slot_10_30["category"] == "WORK"
    assert slot_10_30["active_minutes"] == 15.0
    assert slot_10_30["intensity"] == 50
    assert slot_10_30["height"] > 10


def test_audit_planned_vs_completed():
    conn = database.get_db_connection()
    today = date.today().isoformat()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO activity_events (timestamp, app_name, window_title, category, duration_seconds)
            VALUES (?, ?, ?, ?, ?);
        """, (f"{today} 11:00:00", "Opera GX", "BossCoder Dynamic Programming Lab", "STUDY", 3600))
        conn.commit()
    finally:
        conn.close()

    start_ts = f"{today} 00:00:00"
    end_ts = f"{today} 23:59:59"

    schedule_blocks = [
        {"task": "BossCoder Study Block", "mode": "STUDY", "time": "11:00 AM"},
        {"task": "Unfinished Afternoon Task", "mode": "WORK", "time": "03:00 PM"}
    ]
    calendar_events = [
        {"title": "BossCoder Mentorship", "time": "11:00 AM"}
    ]

    flight_log = audit_planned_vs_completed(start_ts, end_ts, schedule_blocks, calendar_events)
    assert len(flight_log) >= 2

    bosscoder_task = next(f for f in flight_log if f["title"] == "BossCoder Study Block")
    assert bosscoder_task["status"] == "COMPLETED"
    assert "1h" in bosscoder_task["logged_duration"]

    unfinished_task = next(f for f in flight_log if f["title"] == "Unfinished Afternoon Task")
    assert unfinished_task["status"] == "CARRIED OVER"
