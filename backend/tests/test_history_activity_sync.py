from datetime import datetime, timezone
import pytest
import database
from collectors.spectrogram import generate_24h_spectrogram


@pytest.fixture(autouse=True)
def setup_tmp_db(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DATA_DIR", tmp_path)
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test_act.db")
    database.init_db()
    yield


def test_zoom_meeting_in_spectrogram():
    conn = database.get_db_connection()
    local_now = datetime.now().astimezone()
    # 18:00 local time meeting (1 hour duration)
    local_meeting_start = datetime.combine(local_now.date(), datetime.min.time(), tzinfo=local_now.tzinfo).replace(hour=18)
    utc_start_str = local_meeting_start.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO activity_events (timestamp, app_name, window_title, category, duration_seconds)
            VALUES (?, ?, ?, ?, ?);
        """, (utc_start_str, "Opera GX", "Zoom Meeting - Standup", "WORK", 3600))
        conn.commit()

        cur.execute("SELECT COUNT(*) FROM activity_events WHERE window_title LIKE '%Zoom%';")
        zoom_count = cur.fetchone()[0]
        assert zoom_count == 1
    finally:
        conn.close()

    start_ts, end_ts = database.get_today_range()
    slots = generate_24h_spectrogram(start_ts, end_ts)
    slot_1800 = next(s for s in slots if s["time"] == "18:00")
    slot_1830 = next(s for s in slots if s["time"] == "18:30")

    assert slot_1800["active_seconds"] > 0
    assert slot_1800["category"] == "WORK"
    assert "Zoom" in slot_1800["top_app"]

    assert slot_1830["active_seconds"] > 0
    assert slot_1830["category"] == "WORK"
    assert "Zoom" in slot_1830["top_app"]
