#!/bin/bash
# DayPilot Nightly Retrospective Script (01:00 AM)
# Compiles daily telemetry into retrospective and saves audit log.

echo "[$(date)] DayPilot Nightly Retrospective initiated..."

if ! curl -s http://127.0.0.1:4000/api/context > /dev/null; then
    echo "Backend offline. Starting temporarily..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR/../backend"
    ./venv/bin/uvicorn app:app --host 127.0.0.1 --port 4000 &
    sleep 2
fi

curl -s http://127.0.0.1:4000/api/briefing/nightly > /dev/null
echo "[$(date)] DayPilot Nightly Retrospective complete."
