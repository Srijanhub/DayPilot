"""
Unit test for Music Preference Learning Engine
"""

import pytest
from music.preference_engine import record_music_play, get_preferred_cluster_for_activity
from database import init_db


def test_preference_learning():
    init_db()
    # Log 3 synthwave plays for WORK
    record_music_play("s1", "Resonance", "HOME", "Synthwave", "WORK", 200)
    record_music_play("s2", "Sunset", "The Midnight", "Synthwave", "WORK", 220)
    record_music_play("s3", "Vampires", "The Midnight", "Synthwave", "WORK", 180)

    # Log 1 Lo-Fi play for WORK
    record_music_play("l1", "Rainy Day", "ChilledCow", "Lo-Fi", "WORK", 150)

    pref = get_preferred_cluster_for_activity("WORK")
    assert pref["genre"] == "Synthwave"
    assert pref["confidence_pct"] >= 70
    assert "Synthwave" in pref["reason"]
