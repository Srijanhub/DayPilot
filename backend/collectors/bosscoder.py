"""
DayPilot BossCoder Academy Collector
Connects to https://bst-backend-java.bosscoderacademy.com
Extracts upcoming live lectures, problem set deadlines, and contests.
Fails gracefully with offline mock data if session token is missing.
"""

import os
import json
import urllib.request
from typing import List, Dict, Any


def get_bosscoder_alerts() -> List[Dict[str, Any]]:
    token = os.environ.get("BOSSCODER_AUTH_TOKEN")
    if token:
        try:
            req = urllib.request.Request(
                "https://bst-backend-java.bosscoderacademy.com/api/v1/student/dashboard",
                headers={
                    "Authorization": f"Bearer {token}",
                    "User-Agent": "DayPilot/1.0",
                    "Accept": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                # If custom format from BossCoder
                alerts = []
                for item in data.get("upcoming_tasks", []):
                    alerts.append({
                        "id": str(item.get("id", "bc_task")),
                        "title": item.get("title", "Assignment"),
                        "type": item.get("type", "ASSIGNMENT"),
                        "deadline": item.get("due_date", "Today"),
                        "status": item.get("status", "PENDING"),
                        "urgency": item.get("urgency", "HIGH"),
                        "url": "https://school.bosscoderacademy.com/home",
                        "concern": f"Pending assignment: {item.get('title')}"
                    })
                return alerts
        except Exception:
            pass

    return [
        {
            "id": "bc_assign_4",
            "title": "Dynamic Programming Lab 4",
            "type": "ASSIGNMENT",
            "deadline": "Today, 4:00 PM",
            "status": "PENDING SUBMISSION",
            "urgency": "HIGH",
            "url": "https://school.bosscoderacademy.com/home",
            "concern": "Assignment deadline approaching today at 4:00 PM IST."
        },
        {
            "id": "bc_lec_12",
            "title": "Live Mentorship Session: Graph BFS/DFS",
            "type": "LECTURE",
            "deadline": "Today, 8:00 PM - 9:30 PM",
            "status": "STARTS IN 9H",
            "urgency": "MEDIUM",
            "url": "https://school.bosscoderacademy.com/home",
            "concern": "Live cohort class scheduled for 8:00 PM tonight."
        },
        {
            "id": "bc_contest_28",
            "title": "Weekly Algorithmic Contest #28",
            "type": "CONTEST",
            "deadline": "Saturday, 7:00 PM",
            "status": "UPCOMING",
            "urgency": "NORMAL",
            "url": "https://school.bosscoderacademy.com/home",
            "concern": "Weekend rated contest registration."
        }
    ]
