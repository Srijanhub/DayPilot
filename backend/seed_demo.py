#!/usr/bin/env python3
"""
DayPilot Demo Seed Script
Populates local SQLite database (~/daypilot/data/activity.db) with a realistic,
rich day of telemetry, bookmarks, voice memos, and music listening habits.
Allows instant zero-setup demonstration of DayPilot's morning brief and nightly retrospective.
"""

import os
import sqlite3
from datetime import datetime, timedelta
from database import init_db, get_db_connection


def seed_demo_data():
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    # Clear existing demo data
    cursor.execute("DELETE FROM activity_events;")
    cursor.execute("DELETE FROM media_bookmarks;")
    cursor.execute("DELETE FROM voice_memos;")
    cursor.execute("DELETE FROM music_preferences;")
    cursor.execute("DELETE FROM daily_audits;")

    today_str = datetime.now().strftime("%Y-%m-%d")

    # 1. Seed Realistic Day of Activity Events
    activities = [
        # 09:00 - 11:30 Deep Work in VS Code
        ("com.microsoft.VSCode", "daypilot/frontend - Visual Studio Code", "github.com", "https://github.com/daypilot", "WORK", 9000),
        # 11:30 - 13:00 BossCoder Dynamic Programming Study
        ("Google Chrome", "Dynamic Programming Lab 4 | BossCoder Academy", "school.bosscoderacademy.com", "https://school.bosscoderacademy.com/home", "STUDY", 5400),
        # 13:00 - 13:45 Manhwa reading break
        ("Google Chrome", "The Greatest Estate Developer - Chapter 148 - Asura Scans", "asuracomic.net", "https://asuracomic.net/series/the-greatest-estate-developer/chapter-148", "RELAX", 2700),
        # 14:00 - 16:30 GitHub PR Review & Terminal
        ("com.apple.Terminal", "zsh - daypilot git commit", "github.com", "https://github.com/daypilot/pull/42", "WORK", 9000),
        # 16:30 - 17:30 Arcane Streaming
        ("Google Chrome", "Netflix - Arcane: Season 2 (Episode 4)", "netflix.com", "https://netflix.com/watch/arcane-s2-e4", "RELAX", 3600),
        # 19:30 - 20:30 Solo Leveling Manhwa
        ("Google Chrome", "Solo Leveling: Ragnarok - Chapter 36 - Flame Comics", "flamecomics.me", "https://flamecomics.me/series/solo-leveling-ragnarok/chapter-36", "RELAX", 3600),
        # 20:30 - 22:00 BossCoder Live Class
        ("Google Chrome", "Live Mentorship Session: Graph BFS/DFS | BossCoder", "school.bosscoderacademy.com", "https://school.bosscoderacademy.com/live", "STUDY", 5400),
    ]

    for app, title, dom, url, cat, dur in activities:
        cursor.execute("""
        INSERT INTO activity_events (app_name, window_title, domain, url, category, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?);
        """, (app, title, dom, url, cat, dur))

    # 2. Seed Media Bookmarks ("Where I Left Off")
    bookmarks = [
        ("MANHWA", "The Greatest Estate Developer", "Chapter 148", None, "https://asuracomic.net/series/the-greatest-estate-developer/chapter-148"),
        ("MANHWA", "Solo Leveling: Ragnarok", "Chapter 36", None, "https://flamecomics.me/series/solo-leveling-ragnarok/chapter-36"),
        ("SHOW", "Arcane: Season 2", "Episode 4", "34:12", "https://netflix.com/watch/arcane-s2-e4"),
    ]

    for mtype, title, unit, offset, url in bookmarks:
        cursor.execute("""
        INSERT INTO media_bookmarks (media_type, title, current_unit, timestamp_offset, resume_url)
        VALUES (?, ?, ?, ?, ?);
        """, (mtype, title, unit, offset, url))

    # 3. Seed Voice Memos
    memos = [
        ("memo_morning.webm", 24.5, "Remember to review BossCoder Dynamic Programming Lab 4 edge cases and test tree traversal balancing.", "Review DP Lab 4 edge cases"),
        ("memo_evening.webm", 18.0, "Refactor the context state machine to ensure the 120s hysteresis debounce works seamlessly on Firefox.", "Refactor debounce tests")
    ]

    for fpath, dur, transcript, action in memos:
        cursor.execute("""
        INSERT INTO voice_memos (file_path, duration_seconds, transcription, action_item)
        VALUES (?, ?, ?, ?);
        """, (fpath, dur, transcript, action))

    # 4. Seed Music Preferences
    music = [
        ("t1", "Resonance", "HOME", "Synthwave", "WORK", 214),
        ("t2", "Days of Thunder", "The Midnight", "Synthwave", "WORK", 310),
        ("t3", "Vampires", "The Midnight", "Synthwave", "WORK", 260),
        ("t4", "Gymnopédie No. 1", "Erik Satie", "Classical Piano", "STUDY", 210),
        ("t5", "Lofi Rain Beats", "ChilledCow", "Lo-Fi Beats", "STUDY", 185),
        ("t6", "Weightless", "Marconi Union", "Ambient Soundscapes", "RELAX", 480),
        ("t7", "Suzume Theme", "Radwimps", "Ambient Soundscapes", "RELAX", 250),
    ]

    for tid, tname, artist, genre, state, dwell in music:
        cursor.execute("""
        INSERT INTO music_preferences (track_id, track_name, artist, genre, activity_state, dwell_seconds)
        VALUES (?, ?, ?, ?, ?, ?);
        """, (tid, tname, artist, genre, state, dwell))

    conn.commit()
    conn.close()
    print("Realistic demo telemetry seeded successfully into SQLite.")


if __name__ == "__main__":
    seed_demo_data()
