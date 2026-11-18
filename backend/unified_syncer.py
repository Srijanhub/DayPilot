"""
DayPilot Unified Synchronization Daemon
Maintains real-time background sync across all connected integrations:
- Opera GX History (every 60s)
- BossCoder Academy (every 3m)
- GitHub PRs & Notifications (every 2m)
- Gmail Executive Digest (every 5m)
- Morning & Live Briefing Cache (instant response)
"""

import asyncio
import time
from typing import Dict, Any, Optional

from history_syncer import sync_opera_gx_history
from collectors.bosscoder import get_bosscoder_alerts
from collectors.github_sync import get_github_notifications
from collectors.google_suite import get_priority_emails, get_calendar_events
from collectors.quotes import get_quote_of_the_day
from collectors.newspaper import get_morning_newspaper, refresh_news
from collectors.briefing_engine import MorningBriefingSchema, ScheduleBlock


def _parse_time_to_minutes(t_str: str) -> Optional[int]:
    """Parse time string like '10:00 AM', '2:30 PM', '14:00' to minutes from midnight."""
    import re
    t_clean = t_str.strip().upper()
    match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)?', t_clean)
    if not match:
        match_h = re.search(r'(\d{1,2})\s*(AM|PM)', t_clean)
        if match_h:
            h = int(match_h.group(1))
            meridiem = match_h.group(2)
            if meridiem == "PM" and h < 12:
                h += 12
            elif meridiem == "AM" and h == 12:
                h = 0
            return h * 60
        return None
    h = int(match.group(1))
    m = int(match.group(2))
    meridiem = match.group(3)
    if meridiem == "PM" and h < 12:
        h += 12
    elif meridiem == "AM" and h == 12:
        h = 0
    return h * 60 + m


def _minutes_to_time_str(mins: int) -> str:
    """Format minutes from midnight to 'hh:mm AM/PM'."""
    mins = max(0, min(1439, mins))
    h = mins // 60
    m = mins % 60
    meridiem = "AM" if h < 12 else "PM"
    h12 = h % 12
    if h12 == 0:
        h12 = 12
    return f"{h12:02d}:{m:02d} {meridiem}"


def find_calendar_gaps(calendar_events: list) -> list:
    """
    Calculates non-overlapping free time windows between 09:00 AM and 10:30 PM.
    Returns a list of (start_minute, end_minute) tuples.
    """
    import re
    busy_spans = []
    for event in calendar_events:
        t_raw = str(event.get("time", "")).strip()
        if not t_raw or any(k in t_raw.lower() for k in ["today", "all day", "unscheduled"]):
            continue
        parts = t_raw.split("-")
        if len(parts) == 2:
            # If start doesn't have AM/PM but end does, borrow
            p0 = parts[0].strip()
            p1 = parts[1].strip()
            if ("AM" in p1.upper() or "PM" in p1.upper()) and not ("AM" in p0.upper() or "PM" in p0.upper()):
                meridiem = "AM" if "AM" in p1.upper() else "PM"
                p0 = f"{p0} {meridiem}"
            start_m = _parse_time_to_minutes(p0)
            end_m = _parse_time_to_minutes(p1)
            if start_m is not None and end_m is not None and start_m < end_m:
                busy_spans.append((start_m, end_m))
        elif len(parts) == 1:
            start_m = _parse_time_to_minutes(parts[0])
            if start_m is not None:
                busy_spans.append((start_m, min(1439, start_m + 60)))

    busy_spans.sort(key=lambda x: x[0])
    merged_busy = []
    for span in busy_spans:
        if not merged_busy:
            merged_busy.append(span)
        else:
            prev_s, prev_e = merged_busy[-1]
            if span[0] <= prev_e:
                merged_busy[-1] = (prev_s, max(prev_e, span[1]))
            else:
                merged_busy.append(span)

    day_start = 540   # 09:00 AM
    day_end = 1350   # 10:30 PM
    gaps = []
    curr = day_start

    for b_start, b_end in merged_busy:
        if b_start > curr and (b_start - curr) >= 45:
            gaps.append((curr, b_start))
        curr = max(curr, b_end)

    if day_end > curr and (day_end - curr) >= 45:
        gaps.append((curr, day_end))

    return gaps


class UnifiedSyncEngine:
    def __init__(self):
        self._cached_briefing: Optional[Dict[str, Any]] = None
        self._last_history_sync = 0
        self._last_github_sync = 0
        self._last_bosscoder_sync = 0
        self._last_email_sync = 0
        
        # State stores
        self.bosscoder_data = []
        self.github_data = []
        self.email_data = []
        self.calendar_data = []
        self.quote_data = {}
        self.newspaper_digest = []
        self.synced_bookmarks_count = 0
        self.broadcast_callback = None

    def set_broadcast_callback(self, cb):
        self.broadcast_callback = cb

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        if self.broadcast_callback:
            try:
                await self.broadcast_callback(event_type, data)
            except Exception as e:
                print(f"[UnifiedSync] Broadcast error: {e}")

    def sync_history(self) -> int:
        try:
            from database import prune_media_bookmarks
            count = sync_opera_gx_history()
            prune_media_bookmarks(50)
            self._last_history_sync = time.time()
            self.synced_bookmarks_count = count
            return count
        except Exception as e:
            print(f"[UnifiedSync] Error syncing Opera GX history: {e}")
            return 0

    def sync_github(self):
        try:
            data = get_github_notifications()
            if data:
                self.github_data = data
            self._last_github_sync = time.time()
        except Exception as e:
            print(f"[UnifiedSync] Error syncing GitHub: {e}")

    def sync_bosscoder(self):
        try:
            data = get_bosscoder_alerts()
            if data:
                self.bosscoder_data = data
            self._last_bosscoder_sync = time.time()
        except Exception as e:
            print(f"[UnifiedSync] Error syncing BossCoder: {e}")

    def sync_emails(self):
        try:
            data = get_priority_emails()
            if data is not None:
                self.email_data = data
            self._last_email_sync = time.time()
        except Exception as e:
            print(f"[UnifiedSync] Error syncing Gmail: {e}")

    def rebuild_briefing_cache(self):
        """Synthesizes the morning/live briefing in-memory using latest live data."""
        if not self.quote_data:
            self.quote_data = get_quote_of_the_day()
        if not self.calendar_data:
            self.calendar_data = get_calendar_events()
        self.newspaper_digest = get_morning_newspaper()

        top_bc = self.bosscoder_data[0] if self.bosscoder_data else None
        top_gh = self.github_data[0] if self.github_data else None

        if top_gh and top_bc:
            priority_focus = f"Prioritize reviewing {top_gh.get('repo', 'GitHub')} {top_gh.get('pr', 'PR')} ({top_gh.get('title', '')[:45]}...) and advance {top_bc.get('title', 'BossCoder lecture')}."
        elif top_gh:
            priority_focus = f"Primary focus: Iterate and follow up on {top_gh.get('repo', 'GitHub')} {top_gh.get('pr', 'PR')}."
        elif top_bc:
            priority_focus = f"Primary study focus: Advance {top_bc.get('title', 'BossCoder topic')}."
        else:
            priority_focus = "Execution mode: Deep focus block on local engineering tasks."

        schedule_blocks = []
        gaps = find_calendar_gaps(self.calendar_data)
        gap_idx = 0

        # 1. Study Block (BossCoder) placed in first calendar gap
        if self.bosscoder_data:
            active_lecture = next((b for b in self.bosscoder_data if b.get("type") == "LECTURE"), self.bosscoder_data[0])
            if gap_idx < len(gaps):
                gs, ge = gaps[gap_idx]
                dur = min(ge - gs, 90)
                time_str = f"{_minutes_to_time_str(gs)} - {_minutes_to_time_str(gs + dur)}"
                gap_idx += 1
            else:
                time_str = "09:30 - 11:00 AM"

            schedule_blocks.append({
                "time": time_str,
                "task": f"Deep Study: {active_lecture.get('title', 'BossCoder Lecture')}",
                "mode": "STUDY",
                "url": "https://school.bosscoderacademy.com/home"
            })

        # 2. Engineering & PR Review Block placed in subsequent calendar gap
        if self.github_data:
            active_pr = self.github_data[0]
            if gap_idx < len(gaps):
                gs, ge = gaps[gap_idx]
                dur = min(ge - gs, 60)
                time_str = f"{_minutes_to_time_str(gs)} - {_minutes_to_time_str(gs + dur)}"
                gap_idx += 1
            else:
                time_str = "03:00 - 04:00 PM"

            schedule_blocks.append({
                "time": time_str,
                "task": f"GitHub PR Review: {active_pr.get('repo')} {active_pr.get('pr')}",
                "mode": "WORK",
                "url": active_pr.get("url")
            })

        # 3. Wind-down / Relax Block placed in evening calendar gap
        if gaps:
            gs, ge = gaps[-1]
            dur = min(ge - gs, 60)
            time_str = f"{_minutes_to_time_str(ge - dur)} - {_minutes_to_time_str(ge)}"
        else:
            time_str = "09:30 - 10:30 PM"

        schedule_blocks.append({
            "time": time_str,
            "task": "Wind-down: Leisure Reading / Media Radar",
            "mode": "RELAX",
            "url": None
        })

        self._cached_briefing = {
            "morning_quote": self.quote_data.get("quote", "Keep shipping."),
            "morning_quote_author": self.quote_data.get("author", "DayPilot"),
            "priority_focus": priority_focus,
            "schedule_blocks": schedule_blocks,
            "newspaper_digest": self.newspaper_digest,
            "bosscoder_alerts": self.bosscoder_data,
            "github_notifications": self.github_data,
            "calendar_events": self.calendar_data,
            "priority_emails": self.email_data
        }

    async def sync_news(self, force: bool = False):
        """Fetch live headlines, refresh the digest and tell the UI."""
        try:
            report = await refresh_news(force=force)
            self.rebuild_briefing_cache()
            if not report.get("throttled"):
                await self.broadcast("NEWS_UPDATED", {"new": report["new"]})
        except Exception as e:
            print(f"[UnifiedSync] Error syncing news: {e}")

    def get_cached_briefing(self) -> Dict[str, Any]:
        if not self._cached_briefing:
            self.rebuild_briefing_cache()
        return self._cached_briefing or {}

    async def sync_all_now(self) -> Dict[str, Any]:
        """Runs a complete sync across all services immediately."""
        loop = asyncio.get_event_loop()
        
        # 1. Opera GX History
        h_count = await loop.run_in_executor(None, self.sync_history)
        
        # 2. GitHub
        await loop.run_in_executor(None, self.sync_github)
        
        # 3. BossCoder
        await loop.run_in_executor(None, self.sync_bosscoder)
        
        # 4. Gmail (in executor to avoid blocking loop)
        await loop.run_in_executor(None, self.sync_emails)

        # 5. Live news
        await self.sync_news(force=True)

        # 6. Rebuild briefing
        self.rebuild_briefing_cache()

        # Broadcast update
        await self.broadcast("TELEMETRY_SYNCED", {
            "bookmarks": h_count,
            "github": len(self.github_data),
            "bosscoder": len(self.bosscoder_data),
            "emails": len(self.email_data),
            "timestamp": time.time()
        })

        return {
            "status": "ok",
            "history_bookmarks_synced": h_count,
            "github_items": len(self.github_data),
            "bosscoder_alerts": len(self.bosscoder_data),
            "emails": len(self.email_data)
        }

    async def start_background_loop(self):
        """Continuous background synchronization daemon loop."""
        print("[UnifiedSync] Starting background synchronization daemon...")
        
        # Initial run on startup
        try:
            await self.sync_all_now()
        except Exception as e:
            print(f"[UnifiedSync] Initial sync exception: {e}")

        tick = 0
        while True:
            await asyncio.sleep(10)  # Check every 10 seconds
            tick += 10
            loop = asyncio.get_event_loop()

            # Every 60s: sync Opera GX history
            if tick % 60 == 0:
                h_count = await loop.run_in_executor(None, self.sync_history)
                if h_count > 0:
                    await self.broadcast("BOOKMARKS_UPDATED", {"count": h_count})

            # Every 120s (2m): sync GitHub PRs & Notifications
            if tick % 120 == 0:
                await loop.run_in_executor(None, self.sync_github)
                self.rebuild_briefing_cache()
                await self.broadcast("GITHUB_UPDATED", {"items": len(self.github_data)})

            # Every 180s (3m): sync BossCoder Academy
            if tick % 180 == 0:
                await loop.run_in_executor(None, self.sync_bosscoder)
                self.rebuild_briefing_cache()
                await self.broadcast("BOSSCODER_UPDATED", {"alerts": len(self.bosscoder_data)})

            # Every 300s (5m): sync Gmail unread digests
            if tick % 300 == 0:
                await loop.run_in_executor(None, self.sync_emails)
                self.rebuild_briefing_cache()
                await self.broadcast("EMAILS_UPDATED", {"emails": len(self.email_data)})

            # Every 600s (10m): fetch fresh headlines
            if tick % 600 == 0:
                await self.sync_news()

            # Every 3600s (1 hour): prune media bookmarks to top 50
            if tick % 3600 == 0:
                from database import prune_media_bookmarks
                await loop.run_in_executor(None, prune_media_bookmarks, 50)


# Global instance
sync_engine = UnifiedSyncEngine()
