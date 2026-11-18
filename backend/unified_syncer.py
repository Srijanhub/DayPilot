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
from collectors.newspaper import get_morning_newspaper
from collectors.briefing_engine import MorningBriefingSchema, ScheduleBlock


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
            count = sync_opera_gx_history()
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
        if not self.newspaper_digest:
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
        if self.bosscoder_data:
            active_lecture = next((b for b in self.bosscoder_data if b.get("type") == "LECTURE"), self.bosscoder_data[0])
            schedule_blocks.append({
                "time": "10:00 - 11:45 AM",
                "task": f"Deep Study: {active_lecture.get('title', 'BossCoder Lecture')}",
                "mode": "STUDY",
                "url": "https://school.bosscoderacademy.com/home"
            })

        if self.github_data:
            active_pr = self.github_data[0]
            schedule_blocks.append({
                "time": "02:00 - 03:00 PM",
                "task": f"GitHub PR Review: {active_pr.get('repo')} {active_pr.get('pr')}",
                "mode": "WORK",
                "url": active_pr.get("url")
            })

        schedule_blocks.append({
            "time": "08:30 - 09:30 PM",
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

        # 5. Rebuild briefing
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


# Global instance
sync_engine = UnifiedSyncEngine()
