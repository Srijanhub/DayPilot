#!/bin/bash
# DayPilot launchd Uninstallation Script
# Unloads and removes DayPilot background timers.

LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

launchctl unload "$LAUNCH_AGENTS_DIR/com.daypilot.morning.plist" 2>/dev/null
launchctl unload "$LAUNCH_AGENTS_DIR/com.daypilot.nightly.plist" 2>/dev/null

rm -f "$LAUNCH_AGENTS_DIR/com.daypilot.morning.plist"
rm -f "$LAUNCH_AGENTS_DIR/com.daypilot.nightly.plist"

echo "DayPilot launchd daemons successfully removed."
