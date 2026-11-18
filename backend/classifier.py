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
        self.last_heartbeat_time: float = time.time()

        # Classification rule tables (can be loaded or configured)
        self.work_apps = {
            "com.microsoft.vscode", "vscode", "terminal", "iterm2", "cursor",
            "com.apple.terminal", "com.googlecode.iterm2", "xcode", "sublime_text"
        }
        self.work_domains = {
            "github.com", "gitlab.com", "stackoverflow.com", "leetcode.com",
            "developer.mozilla.org", "localhost", "127.0.0.1", "npm.im", "pypi.org"
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

        # 3. Work checks (IDE, Terminal, GitHub)
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
        Process incoming heartbeat.
        Returns: (effective_mode, did_mode_change)
        """
        now = time.time()
        self.last_heartbeat_time = now

        # If manual override is engaged, it always takes precedence
        if self.manual_override != "AUTO":
            target_forced = self.manual_override.replace("FORCE_", "")
            did_change = (self.committed_mode != target_forced)
            self.committed_mode = target_forced
            return self.committed_mode, did_change

        # Check idle timeout
        if idle_seconds > self.idle_timeout:
            return self.committed_mode, False

        # Classify instantaneous target
        target = self.classify_target(app_name, domain, title)

        if target == self.committed_mode:
            # Reset pending since we are in the committed mode
            self.pending_mode = None
            self.pending_start_time = None
            return self.committed_mode, False

        # Target is different from committed mode
        if self.pending_mode != target:
            # New candidate mode started
            self.pending_mode = target
            self.pending_start_time = now
            return self.committed_mode, False

        # Candidate is sustaining
        if self.pending_start_time and (now - self.pending_start_time >= self.hysteresis_threshold):
            # Hysteresis threshold reached! Commit new mode
            old_mode = self.committed_mode
            self.committed_mode = target
            self.pending_mode = None
            self.pending_start_time = None
            return self.committed_mode, True

        return self.committed_mode, False

    def set_manual_override(self, override: str) -> str:
        """Set manual override: AUTO, FORCE_WORK, FORCE_STUDY, FORCE_RELAX"""
        self.manual_override = override
        if override != "AUTO":
            self.committed_mode = override.replace("FORCE_", "")
        return self.committed_mode
