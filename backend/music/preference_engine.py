"""
DayPilot Music Preference Learning Engine
Computes empirical conditional probabilities P(genre | activity) from SQLite logs
and biases auto-queueing toward user's proven focus habits.
"""

from typing import Dict, Any, Optional
from database import get_db_connection


def record_music_play(track_id: str, track_name: str, artist: str, genre: str, activity_state: str, dwell_seconds: int = 180):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO music_preferences (track_id, track_name, artist, genre, activity_state, dwell_seconds)
    VALUES (?, ?, ?, ?, ?, ?);
    """, (track_id, track_name, artist, genre, activity_state, dwell_seconds))
    conn.commit()
    conn.close()


def get_preferred_cluster_for_activity(activity: str) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    # Query genre distribution for current activity
    cursor.execute("""
    SELECT genre, COUNT(*) as count
    FROM music_preferences
    WHERE activity_state = ?
    GROUP BY genre
    ORDER BY count DESC
    LIMIT 1;
    """, (activity,))
    row = cursor.fetchone()

    cursor.execute("""
    SELECT COUNT(*) as total
    FROM music_preferences
    WHERE activity_state = ?;
    """, (activity,))
    total_row = cursor.fetchone()
    total = total_row["total"] if total_row else 0

    conn.close()

    if row and total > 0:
        pct = int((row["count"] / total) * 100)
        return {
            "cluster": f"Custom {row['genre']} Mix",
            "genre": row["genre"],
            "confidence_pct": pct,
            "reason": f"Queued {row['genre']}: {pct}% of your {activity.lower()} listens"
        }

    # Curated acoustic baseline presets (when empirical logs are gathering)
    defaults = {
        "WORK": {
            "cluster": "Deep Focus Flow",
            "genre": "Synthwave / Dark Techno",
            "confidence_pct": None,
            "track": "Resonance — HOME",
            "reason": "Curated acoustic preset optimized for coding flow & syntax focus"
        },
        "STUDY": {
            "cluster": "Study & Problem Solving",
            "genre": "Lo-Fi Beats / Piano",
            "confidence_pct": None,
            "track": "Lofi Rain Session — ChilledCow",
            "reason": "Curated acoustic preset optimized for algorithmic study & reading"
        },
        "RELAX": {
            "cluster": "Late Night Chill",
            "genre": "Ambient Soundscapes",
            "confidence_pct": None,
            "track": "Weightless — Marconi Union",
            "reason": "Curated acoustic preset for wind-down & leisure reading"
        }
    }
    return defaults.get(activity, defaults["WORK"])
