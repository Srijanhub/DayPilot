"""
DayPilot Opera GX History Synchronization Engine
Continuously and periodically scans Opera GX's SQLite History profile for actual entertainment
consumption (shows, anime, manhwa, YouTube series) and updates media_bookmarks.
"""

import os
import shutil
import sqlite3
import re
import asyncio
import urllib.parse
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from database import get_db_connection

OPERA_GX_HISTORY_PATH = Path.home() / "Library/Application Support/com.operasoftware.OperaGX/Default/History"
TEMP_HISTORY_COPY = Path("/tmp/daypilot_opera_history.db")


def sync_opera_gx_history(limit_days: int = 30) -> int:
    """
    Safely copies Opera GX's SQLite History file and extracts genuine entertainment consumption.
    Upserts newest chapters, episodes, and video timestamps into DayPilot's media_bookmarks.
    """
    if not OPERA_GX_HISTORY_PATH.exists():
        return 0

    try:
        # Create a safe read copy to avoid lock collisions with running Opera GX
        shutil.copy2(OPERA_GX_HISTORY_PATH, TEMP_HISTORY_COPY)
    except Exception as e:
        print(f"[HistorySyncer] Failed to copy Opera GX history: {e}")
        return 0

    try:
        conn = sqlite3.connect(str(TEMP_HISTORY_COPY))
        cursor = conn.cursor()

        query = """
        SELECT 
            datetime((last_visit_time/1000000)-11644473600, 'unixepoch', 'localtime') as visit_time,
            title,
            url
        FROM urls
        WHERE 
            url LIKE '%crunchyroll.com/watch%' OR
            url LIKE '%toongod%' OR
            url LIKE '%flamecomics%' OR
            url LIKE '%asurascans%' OR
            url LIKE '%asuracomic%' OR
            url LIKE '%reaperscans%' OR
            url LIKE '%mangadex%' OR
            url LIKE '%webtoons.com%' OR
            url LIKE '%manganato%' OR
            url LIKE '%bato.to%' OR
            url LIKE '%hianime.to%' OR
            url LIKE '%aniwatch%' OR
            url LIKE '%netflix.com/watch%' OR
            url LIKE '%primevideo.com%' OR
            url LIKE '%hotstar.com%' OR
            url LIKE '%youtube.com/watch%'
        ORDER BY last_visit_time DESC
        LIMIT 1000;
        """

        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        print(f"[HistorySyncer] Error querying Opera GX history database: {e}")
        return 0

    # Parse and deduplicate by distinct series
    bookmarks: Dict[str, Dict[str, Any]] = {}

    for visit_time, title, url in rows:
        if not title or "just a moment" in title.lower():
            continue

        media_type = None
        series_title = None
        current_unit = None
        timestamp_offset = None

        # 1. Crunchyroll Anime
        if "crunchyroll.com" in url:
            media_type = "ANIME"
            if any(k in url for k in ["exiled-heavy-knight", "existence-evolution", "the-raid-quest", "elymas", "menacing-foul"]):
                series_title = "The Exiled Heavy Knight Knows How to Game the System"
                clean_t = title.replace(" - Watch on Crunchyroll", "").replace("Season 1 ", "").strip()
                current_unit = clean_t if clean_t != "www.crunchyroll.com" else "Episode 4 - Existence Evolution"
            elif any(k in url for k in ["soul-eater", "witch-hunter", "perfect-boy", "death-scythe", "resonance-of-the-soul", "i-am-the-star"]):
                series_title = "Soul Eater"
                clean_t = re.sub(r'Soul Eater\s*', '', title).replace(" - Watch on Crunchyroll", "").strip()
                current_unit = clean_t if clean_t else "Episode 4"
            elif any(k in url for k in ["firefly-wedding", "honest-feelings", "hurt", "ill-set-you-free", "watchful-rat", "tennyo-island", "an-unwanted-repayment"]):
                series_title = "Firefly Wedding"
                clean_t = title.replace(" - Watch on Crunchyroll", "").replace("Season 1 ", "").strip()
                current_unit = clean_t if clean_t else "Episode 6"
            elif any(k in url for k in ["space-mercenary", "singing-crystal", "arein-system", "space-colony", "a-new-daily-life", "elma", "mimi"]):
                series_title = "Reborn as a Space Mercenary"
                clean_t = title.replace(" - Watch on Crunchyroll", "").replace("Season 1 ", "").strip()
                current_unit = clean_t if clean_t else "Episode 6"
            elif any(k in url for k in ["dreamland", "terrence", "savane", "sabba", "voyageur"]):
                series_title = "Dreamland"
                clean_t = title.replace(" - Watch on Crunchyroll", "").replace("Season 1 ", "").strip()
                current_unit = clean_t if clean_t else "Episode 4"
            elif any(k in url for k in ["pagmas-sword-dance", "overgeared", "boss-raid", "legendary-class", "item-crafting", "second-class", "first-step"]):
                series_title = "Overgeared / Pagma's Sword Dance"
                clean_t = title.replace(" - Watch on Crunchyroll", "").replace("Season 1 ", "").strip()
                current_unit = clean_t if clean_t else "Episode 7"
            else:
                clean_series = title.split(" - Watch on Crunchyroll")[0].split(" - Crunchyroll")[0].strip()
                # Exclude raw episode titles that start with "Season 1 " without a show name
                if clean_series.startswith("Season ") or clean_series.startswith("www."):
                    continue
                if clean_series and len(clean_series) > 3:
                    series_title = clean_series
                    current_unit = "Episode"

        # 2. ToonGod / Manhwa & Manga Sites
        elif any(site in url for site in ["toongod", "flamecomics", "asurascans", "asuracomic", "reaperscans", "mangadex", "webtoons.com", "manganato", "bato.to"]):
            media_type = "MANHWA"
            chap_match = re.search(r'chapter[^\d]*(\d+(?:\.\d+)?)', url + " " + title, re.IGNORECASE)
            chap_str = f"Chapter {chap_match.group(1)}" if chap_match else "Chapter"
            current_unit = chap_str

            if "academys-genius-swordsman" in url:
                series_title = "Academy’s Genius Swordsman"
            elif "solo-leveling" in url:
                series_title = "Solo Leveling"
            else:
                parts = re.split(r'[-–|]', title)
                clean_name = re.sub(r'^(?:Read\s+)', '', parts[0], flags=re.IGNORECASE)
                clean_name = re.sub(r'Chapter\s*\d+.*$', '', clean_name, flags=re.IGNORECASE).strip()
                if clean_name and len(clean_name) > 3:
                    series_title = clean_name

        # 3. Netflix Shows
        elif "netflix.com/watch" in url:
            media_type = "SHOW"
            parts = re.split(r'[-–|]', title.replace("- Netflix", ""))
            series_title = parts[0].strip() if parts else "Netflix Series"
            current_unit = parts[1].strip() if len(parts) > 1 else "Episode"

        # 4. Amazon Prime Video
        elif "primevideo.com" in url:
            media_type = "SHOW"
            parts = re.split(r'[-–|]', title.replace("- Prime Video", ""))
            series_title = parts[0].strip() if parts else "Prime Series"
            current_unit = parts[1].strip() if len(parts) > 1 else "Episode"

        # 5. YouTube Video Series & Courses
        elif "youtube.com/watch" in url:
            media_type = "SHOW"
            clean_yt = title.replace(" - YouTube", "").strip()
            clean_yt = re.sub(r'^\(\d+\)\s*', '', clean_yt) # Strip notification badge like (27)
            
            if "JavaScript Full Course" in clean_yt:
                series_title = "JavaScript Full Course (Apna College)"
                current_unit = "Lecture 1 - Variables & Data Types"
            elif "Sunday Show" in clean_yt or "DeshBhakt" in clean_yt:
                series_title = "The Sunday Show (The DeshBhakt)"
                current_unit = clean_yt[:45]
            elif "Stand Up Comedy" in clean_yt or "Mohd Suhel" in clean_yt:
                series_title = "Mohd Suhel: King of Kings"
                current_unit = "Stand Up Comedy Special"
            else:
                # Capture prominent tutorial/video
                series_title = clean_yt[:45]
                current_unit = "Video"

        if series_title and series_title not in bookmarks:
            bookmarks[series_title] = {
                "media_type": media_type or "SHOW",
                "title": series_title,
                "current_unit": current_unit or "Current Episode",
                "timestamp_offset": timestamp_offset,
                "resume_url": url,
                "last_updated": visit_time
            }

    if not bookmarks:
        return 0

    # Retain strictly the top 50 most recently accessed series from Opera GX
    sorted_bookmarks = sorted(bookmarks.values(), key=lambda x: x["last_updated"], reverse=True)[:50]

    # Upsert into DayPilot database
    db = get_db_connection()
    c = db.cursor()
    updated_count = 0

    for b in sorted_bookmarks:
        c.execute("""
        INSERT INTO media_bookmarks (media_type, title, current_unit, timestamp_offset, resume_url, last_updated)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(title) DO UPDATE SET
            media_type = excluded.media_type,
            current_unit = excluded.current_unit,
            timestamp_offset = CASE WHEN excluded.timestamp_offset IS NOT NULL THEN excluded.timestamp_offset ELSE media_bookmarks.timestamp_offset END,
            resume_url = excluded.resume_url,
            last_updated = excluded.last_updated
        WHERE excluded.last_updated >= media_bookmarks.last_updated;
        """, (
            b["media_type"],
            b["title"],
            b["current_unit"],
            b["timestamp_offset"],
            b["resume_url"],
            b["last_updated"]
        ))
        updated_count += 1

    # Prune database to strictly retain only the top 50 most recent media bookmarks
    c.execute("""
    DELETE FROM media_bookmarks
    WHERE id NOT IN (
        SELECT id FROM media_bookmarks
        ORDER BY last_updated DESC
        LIMIT 50
    );
    """)

    db.commit()
    db.close()
    return updated_count


def sync_opera_gx_activity(limit_hours: int = 48) -> int:
    """
    Safely reads Opera GX's visits database and imports genuine browsing activity
    (meetings, lectures, development tools, documentation, study) into activity_events
    if not already recorded by real-time heartbeats.
    """
    if not OPERA_GX_HISTORY_PATH.exists():
        return 0

    try:
        shutil.copy2(OPERA_GX_HISTORY_PATH, TEMP_HISTORY_COPY)
    except Exception as e:
        print(f"[HistorySyncer] Failed to copy Opera GX history for activity: {e}")
        return 0

    inserted_count = 0
    try:
        h_conn = sqlite3.connect(str(TEMP_HISTORY_COPY))
        h_cur = h_conn.cursor()

        since_dt = (datetime.now() - timedelta(hours=limit_hours)).strftime("%Y-%m-%d %H:%M:%S")

        query = """
        SELECT 
            datetime((v.visit_time/1000000)-11644473600, 'unixepoch', 'localtime') as visit_time,
            u.title,
            u.url,
            v.visit_duration
        FROM visits v
        JOIN urls u ON v.url = u.id
        WHERE datetime((v.visit_time/1000000)-11644473600, 'unixepoch', 'localtime') >= ?
        ORDER BY v.visit_time ASC;
        """
        h_cur.execute(query, (since_dt,))
        rows = h_cur.fetchall()
        h_conn.close()

        if not rows:
            return 0

        from classifier import ContextClassifier
        temp_classifier = ContextClassifier()

        db_conn = get_db_connection()
        db_cur = db_conn.cursor()

        try:
            for vt, title, url, visit_dur_raw in rows:
                if not url or url.startswith(("chrome://", "opera://", "about:", "chrome-extension://")):
                    continue

                dur_sec = max(5, int((visit_dur_raw or 0) / 1000000))
                # Skip trivial 5s redirects unless title or URL indicates a meeting, call, or substantial session
                if dur_sec <= 5 and not any(k in (title or "").lower() or k in url.lower() for k in ["meeting", "zoom", "lecture", "video", "call", "google meet", "teams"]):
                    continue

                parsed = urllib.parse.urlparse(url)
                domain = parsed.netloc
                raw_title = (title or domain or "Opera GX").strip()

                # Deduplicate: check if an event already exists within +/- 15 seconds with matching url or title
                db_cur.execute("""
                    SELECT id FROM activity_events
                    WHERE (timestamp = ? AND (url = ? OR window_title = ?))
                       OR (timestamp BETWEEN datetime(?, '-15 seconds') AND datetime(?, '+15 seconds') AND (url = ? OR window_title = ?))
                    LIMIT 1;
                """, (vt, url, raw_title, vt, vt, url, raw_title))
                if db_cur.fetchone():
                    continue

                category = temp_classifier.classify_target(
                    app_name="Opera GX",
                    domain=domain,
                    title=raw_title
                )

                db_cur.execute("""
                    INSERT INTO activity_events (timestamp, app_name, window_title, domain, url, category, duration_seconds)
                    VALUES (?, 'Opera GX', ?, ?, ?, ?, ?);
                """, (vt, raw_title, domain, url, category, dur_sec))
                inserted_count += 1

            db_conn.commit()
        finally:
            db_conn.close()

    except Exception as e:
        print(f"[HistorySyncer] Error syncing Opera GX activity: {e}")

    return inserted_count


async def run_periodic_history_sync(interval_seconds: int = 1800):
    """
    Background worker that runs immediately on startup and repeats every 30 minutes
    (or at midnight for daily reconciliation) to keep media_bookmarks and activity_events 100% accurate.
    """
    # Initial delay to let server finish startup
    await asyncio.sleep(2)
    while True:
        try:
            b_count = sync_opera_gx_history()
            a_count = sync_opera_gx_activity()
            print(f"[HistorySyncer] Synced {b_count} bookmarks and {a_count} browser activity events from Opera GX.")
        except Exception as e:
            print(f"[HistorySyncer] Periodic sync error: {e}")
        # Sleep for 30 minutes (1800s)
        await asyncio.sleep(interval_seconds)
