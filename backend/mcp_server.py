#!/usr/bin/env python3
"""
DayPilot MCP Server for Antigravity & Agent Assistant
Exposes DayPilot cockpit telemetry, mode controls, and flight plan tools over stdio MCP protocol.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional

from mcp.server.mcpserver import MCPServer

server = MCPServer(
    name="daypilot-mcp",
    version="1.0.0",
    description="Bridge between Antigravity and DayPilot macOS Flight Deck workstation"
)

DAYPILOT_BACKEND_URL = os.environ.get("DAYPILOT_BACKEND_URL", "http://127.0.0.1:4000")


def _get_api(path: str) -> Dict[str, Any]:
    url = f"{DAYPILOT_BACKEND_URL}{path}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DayPilot-MCP/1.0"})
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e), "url": url}


def _post_api(path: str, data: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{DAYPILOT_BACKEND_URL}{path}"
    try:
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json", "User-Agent": "DayPilot-MCP/1.0"}
        )
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e), "url": url}


@server.tool(
    name="get_daypilot_state",
    description="Retrieve live DayPilot workstation state: active mode (WORK/STUDY/RELAX), focused Opera GX tab, BossCoder curriculum, GitHub PRs, and email digest."
)
def get_daypilot_state() -> str:
    """Returns a comprehensive markdown summary of live DayPilot telemetry."""
    context = _get_api("/api/context")
    live_tab = _get_api("/api/tabs/live")
    briefing = _get_api("/api/briefing/morning")
    bookmarks = _get_api("/api/bookmarks")

    mode = context.get("mode", "WORK")
    override = context.get("override", "AUTO")
    
    output = []
    output.append(f"# DayPilot Cockpit Telemetry")
    output.append(f"- **Current Mode**: `{mode}` (Override: `{override}`)")
    
    if "window_title" in live_tab:
        output.append(f"- **Active Window / Tab**: {live_tab.get('window_title')} ({live_tab.get('domain')}) [Dwell: {live_tab.get('dwell_seconds', 0)}s]")
    
    # BossCoder Section
    if "bosscoder_alerts" in briefing:
        output.append("\n## BossCoder Academy")
        for b in briefing.get("bosscoder_alerts", []):
            output.append(f"- **{b.get('title')}**: {b.get('deadline')} [{b.get('status')}]")
            
    # GitHub Section
    if "github_prs" in briefing:
        output.append("\n## Active GitHub Pull Requests")
        for g in briefing.get("github_prs", []):
            output.append(f"- `{g.get('repo')} {g.get('pr')}`: {g.get('title')} ({g.get('status')})")

    # Priority Emails
    if "priority_emails" in briefing:
        output.append("\n## Executive Email Summaries")
        for e in briefing.get("priority_emails", [])[:4]:
            output.append(f"- **From {e.get('from')}** ({e.get('subject')}): {e.get('summary', e.get('concern', ''))}")

    # Media / Leisure Bookmarks
    if isinstance(bookmarks, list) and bookmarks:
        output.append("\n## Media Radar")
        for b in bookmarks[:2]:
            output.append(f"- {b.get('title')} -> {b.get('current_unit')} ({b.get('resume_url')})")

    return "\n".join(output)


@server.tool(
    name="set_daypilot_mode",
    description="Change DayPilot cockpit mental mode. Valid modes are 'WORK', 'STUDY', 'RELAX', or 'AUTO'."
)
def set_daypilot_mode(mode: str) -> str:
    """Sets the mode override in DayPilot."""
    mode_upper = mode.upper().strip()
    if mode_upper not in ["WORK", "STUDY", "RELAX", "AUTO"]:
        return f"Error: Invalid mode '{mode}'. Choose from WORK, STUDY, RELAX, or AUTO."
    
    res = _post_api("/api/context/override", {"mode": mode_upper})
    if "error" in res:
        return f"Failed to set mode: {res['error']}"
    return f"DayPilot mode successfully set to [{res.get('mode')}] (override: {res.get('override')})."


@server.tool(
    name="open_daypilot_app",
    description="Brings the native DayPilot macOS application window to the front."
)
def open_daypilot_app() -> str:
    """Activates the native macOS DayPilot app."""
    import subprocess
    try:
        subprocess.run(["open", "-a", "DayPilot"], check=True)
        return "DayPilot.app brought to front."
    except Exception as e:
        return f"Could not launch DayPilot.app: {e}"


if __name__ == "__main__":
    server.run(transport="stdio")
