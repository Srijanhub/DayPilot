from history_syncer import sync_opera_gx_activity
from database import get_db_connection
from collectors.spectrogram import generate_24h_spectrogram, audit_planned_vs_completed


def test_zoom_meeting_in_spectrogram():
    conn = get_db_connection()
    cur = conn.cursor()
    # Check that Zoom meeting is present in activity_events
    cur.execute("""
        SELECT COUNT(*) FROM activity_events
        WHERE window_title LIKE '%Zoom%' AND timestamp >= '2026-11-18 18:00:00';
    """)
    zoom_count = cur.fetchone()[0]
    conn.close()

    assert zoom_count >= 1, "Zoom meeting should be recorded in activity_events"

    # Verify spectrogram slot 36 (18:00 - 18:30) and 37 (18:30 - 19:00)
    slots = generate_24h_spectrogram('2026-11-18 00:00:00', '2026-11-18 23:59:59')
    slot_1800 = next(s for s in slots if s["time"] == "18:00")
    slot_1830 = next(s for s in slots if s["time"] == "18:30")

    assert slot_1800["active_seconds"] > 0
    assert slot_1800["category"] == "WORK"
    assert "Zoom" in slot_1800["top_app"]

    assert slot_1830["active_seconds"] > 0
    assert slot_1830["category"] == "WORK"
    assert "Zoom" in slot_1830["top_app"]
