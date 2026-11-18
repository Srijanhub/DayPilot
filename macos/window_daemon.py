#!/usr/bin/env python3
"""
DayPilot macOS Window Daemon
Polls frontmost application bundle ID and window title every 5 seconds,
measures system idle time via Quartz/CGEventSource, and sends heartbeats
to the local DayPilot backend on 127.0.0.1:4000.
"""

import time
import json
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

BACKEND_HEARTBEAT_URL = "http://127.0.0.1:4000/api/heartbeat"
POLL_INTERVAL_SECONDS = 5.0
IDLE_THRESHOLD_SECONDS = 60.0


def get_api_token() -> str:
    """Reads the secure DayPilot local token from ~/daypilot/token."""
    token_file = Path.home() / "daypilot" / "token"
    if token_file.exists():
        try:
            return token_file.read_text().strip()
        except Exception:
            pass
    return ""


def get_idle_time() -> float:
    """Returns system idle seconds via ioreg."""
    try:
        output = subprocess.check_output(
            ["ioreg", "-c", "IOHIDSystem"],
            stderr=subprocess.DEVNULL
        ).decode("utf-8")
        for line in output.split("\n"):
            if "HIDIdleTime" in line:
                nanos = int(line.split("=")[-1].strip())
                return nanos / 1_000_000_000.0
    except Exception:
        pass
    return 0.0


def get_frontmost_window_info():
    """
    Query frontmost application and window title using osascript (AppleScript).
    Requires Accessibility permissions on macOS.
    """
    script = '''
    tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set appName to name of frontApp
        set bundleId to bundle identifier of frontApp
        set winTitle to ""
        try
            set winTitle to name of front window of frontApp
        end try
        return appName & "|||" & bundleId & "|||" & winTitle
    end tell
    '''
    try:
        res = subprocess.check_output(
            ["osascript", "-e", script],
            stderr=subprocess.DEVNULL,
            timeout=2.0
        ).decode("utf-8").strip()
        parts = res.split("|||")
        app_name = parts[0] if len(parts) > 0 else "Unknown"
        bundle_id = parts[1] if len(parts) > 1 else ""
        window_title = parts[2] if len(parts) > 2 else ""
        return app_name, bundle_id, window_title
    except Exception:
        return "Unknown", "", ""


def send_heartbeat(app_name: str, bundle_id: str, window_title: str, idle_seconds: float):
    payload = {
        "app_name": bundle_id or app_name,
        "window_title": window_title,
        "duration_seconds": int(POLL_INTERVAL_SECONDS),
        "idle_seconds": int(idle_seconds)
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        BACKEND_HEARTBEAT_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-DayPilot-Token": get_api_token()
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            pass
    except Exception:
        # Backend might be booting or temporarily offline; silently retry next cycle
        pass


def main():
    print("DayPilot Window Daemon started. Polling every 5s...")
    while True:
        try:
            idle_secs = get_idle_time()
            app_name, bundle_id, window_title = get_frontmost_window_info()
            send_heartbeat(app_name, bundle_id, window_title, idle_secs)
        except Exception as e:
            pass
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
