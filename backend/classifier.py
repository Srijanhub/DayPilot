"""
DayPilot Context Classifier & Debounce Engine
Classifies incoming app/tab heartbeats into WORK, STUDY, or RELAX,
enforcing a 120-second hysteresis debounce to prevent jarring mode thrashing.
"""

import time
from typing import Optional, Dict, Any, Tuple


class ContextClassifier:
    def __init__(self, hysteresis_threshold_seconds: int = 120, idle_timeout_seconds: int = 60):
        self.hysteresis_threshold = hysteresis_threshold_seconds
        self.idle_timeout = idle_timeout_seconds

        # Committed state
        self.committed_mode: str = "WORK"
        self.manual_override: str = "AUTO"  # "AUTO", "FORCE_WORK", "FORCE_STUDY", "FORCE_RELAX"

        # Debounce tracking
        self.pending_mode: Optional[str] = None
        self.pending_start_time: Optional[float] = None
        self.pending_active_seconds: int = 0
        self.last_heartbeat_time: float = time.time()

        # Classification rule tables (can be loaded or configured)
        self.work_apps = {
            "com.microsoft.vscode", "vscode", "terminal", "iterm2", "cursor",
            "com.apple.terminal", "com.googlecode.iterm2", "xcode", "sublime_text",
            "zoom.us", "us.zoom.xos", "zoom", "slack", "microsoft teams", "webex"
        }
        self.work_domains = {
            "github.com", "gitlab.com", "stackoverflow.com", "leetcode.com",
            "developer.mozilla.org", "localhost", "127.0.0.1", "npm.im", "pypi.org",
            "zoom.us", "app.zoom.us", "meet.google.com", "teams.microsoft.com", "slack.com"
        }

        self.study_domains = {
            "school.bosscoderacademy.com", "bosscoderacademy.com", "coursera.org",
            "edx.org", "canvas", "moodle", "blackboard", "arxiv.org"
        }

        self.relax_domains = {
            "netflix.com", "crunchyroll.com", "aniwatch", "asura", "flamecomics",
            "toongod.org", "toongod", "mangadex.org", "webtoons.com", "reaperscans",
            "twitch.tv", "reddit.com", "twitter.com", "x.com", "instagram.com"
        }

    def classify_target(self, app_name: str, domain: Optional[str] = None, title: Optional[str] = None) -> str:
        """Classify single raw telemetry into a target mode."""
        app_clean = (app_name or "").lower()
        domain_clean = (domain or "").lower()
        title_clean = (title or "").lower()

        # 1. Study checks (BossCoder, LMS, course lectures)
        for s_dom in self.study_domains:
            if s_dom in domain_clean:
                return "STUDY"
        if any(keyword in title_clean for keyword in ["bosscoder", "lecture", "algorithm", "data structure", "assignment"]):
            return "STUDY"

        # 2. Relax checks (Shows, Anime, Manhwa, Social)
        for r_dom in self.relax_domains:
            if r_dom in domain_clean:
                return "RELAX"
        if any(keyword in title_clean for keyword in ["chapter ", "ch.", "episode", "season ", "manhwa", "manga", "anime"]):
            return "RELAX"

        # 3. Work checks (IDE, Terminal, GitHub, Zoom Meetings, Video Calls)
        if any(keyword in title_clean for keyword in ["zoom meeting", "zoom", "google meet", "huddle", "call", "webinar", "standup"]):
            return "WORK"
        for w_app in self.work_apps:
            if w_app in app_clean:
                return "WORK"
        for w_dom in self.work_domains:
            if w_dom in domain_clean:
                return "WORK"

        # Default fallback
        return "WORK"

    def process_heartbeat(self, app_name: str, domain: Optional[str] = None,
                          title: Optional[str] = None, duration_seconds: int = 5,
                          idle_seconds: int = 0) -> Tuple[str, bool]:
        """
        Process incoming heartbeat with hysteresis debounce.
        Requires continuous non-idle active dwell before transitioning modes.
        """
        domain_clean = (domain or "").lower()
        title_clean = (title or "").lower()
        is_meeting = (
            "zoom" in domain_clean or "zoom" in title_clean or
            "meet.google.com" in domain_clean or "teams" in domain_clean
        )
        if is_meeting:
            # Meetings/video calls are active listening time even if mouse is stationary
            idle_seconds = 0

        now = time.time()
        heartbeat_gap = now - self.last_heartbeat_time
        self.last_heartbeat_time = now

        # If manual override is engaged, it always takes precedence
        if self.manual_override != "AUTO":
            target_forced = self.manual_override.replace("FORCE_", "")
            did_change = (self.committed_mode != target_forced)
            self.committed_mode = target_forced
            self.pending_mode = None
            self.pending_start_time = None
            self.pending_active_seconds = 0
            return self.committed_mode, did_change

        # 1. Check idle timeout:
        # If user is idle, reset pending mode so stale candidate does NOT survive breaks
        if idle_seconds > self.idle_timeout:
            self.pending_mode = None
            self.pending_start_time = None
            self.pending_active_seconds = 0
            return self.committed_mode, False

        # 2. Check heartbeat gap:
        # If heartbeats stopped for > 30s (system sleep, lid closed, browser quit), clear pending
        if heartbeat_gap > 30:
            self.pending_mode = None
            self.pending_start_time = None
            self.pending_active_seconds = 0

        # Classify instantaneous target
        target = self.classify_target(app_name, domain, title)

        if target == self.committed_mode:
            # We are in current committed mode, reset any pending transition
            self.pending_mode = None
            self.pending_start_time = None
            self.pending_active_seconds = 0
            return self.committed_mode, False

        # Target is different from committed mode
        if self.pending_mode != target:
            # New candidate mode initiated
            self.pending_mode = target
            self.pending_start_time = now
            self.pending_active_seconds = max(1, duration_seconds)
            return self.committed_mode, False

        # Candidate is sustaining: accumulate verified active seconds
        self.pending_active_seconds += duration_seconds

        # Transition only when both active accumulated seconds AND continuous wall-clock time meet threshold
        if (self.pending_active_seconds >= self.hysteresis_threshold and 
            self.pending_start_time and (now - self.pending_start_time >= self.hysteresis_threshold)):
            old_mode = self.committed_mode
            self.committed_mode = target
            self.pending_mode = None
            self.pending_start_time = None
            self.pending_active_seconds = 0
            return self.committed_mode, True

        return self.committed_mode, False

    def set_manual_override(self, override: str) -> str:
        """Set manual override: AUTO, FORCE_WORK, FORCE_STUDY, FORCE_RELAX"""
        self.manual_override = override
        if override != "AUTO":
            self.committed_mode = override.replace("FORCE_", "")
        return self.committed_mode
