#!/bin/bash
# DayPilot launchd Installation Script
# Registers 09:00 AM and 01:00 AM background timers on macOS.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENTS_DIR"

MORNING_PLIST="$SCRIPT_DIR/com.daypilot.morning.plist"
NIGHTLY_PLIST="$SCRIPT_DIR/com.daypilot.nightly.plist"

cp "$MORNING_PLIST" "$LAUNCH_AGENTS_DIR/"
cp "$NIGHTLY_PLIST" "$LAUNCH_AGENTS_DIR/"

launchctl load "$LAUNCH_AGENTS_DIR/com.daypilot.morning.plist"
launchctl load "$LAUNCH_AGENTS_DIR/com.daypilot.nightly.plist"

echo "DayPilot launchd daemons successfully installed in $LAUNCH_AGENTS_DIR."
echo "09:00 AM: Morning Ignition (weekdays)"
echo "01:00 AM: Nightly Retrospective (daily)"
