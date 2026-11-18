#!/bin/bash
# DayPilot Morning Ignition Script (09:00 AM)
# Triggers morning briefing collectors and pops open dashboard.

echo "[$(date)] DayPilot Morning Ignition initiated..."

# 1. Ensure backend is running
if ! curl -s http://127.0.0.1:4000/api/context > /dev/null; then
    echo "Starting DayPilot backend..."
    cd /Users/srijanhalder/Desktop/Experiments/daypilot/backend
    ./venv/bin/uvicorn app:app --host 127.0.0.1 --port 4000 &
    sleep 2
fi

# 2. Trigger morning compilation
curl -s http://127.0.0.1:4000/api/briefing/morning > /dev/null

# 3. Pop open dashboard
open "http://localhost:3000"
echo "[$(date)] DayPilot Morning Ignition complete."
