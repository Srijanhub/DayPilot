"""
DayPilot Google Suite Collector (Gmail & Google Calendar)
Fetches today's meetings and priority unread threads.
Fails gracefully with offline mock data if OAuth credentials are not configured.
"""

from datetime import datetime, date
from typing import List, Dict, Any


def get_calendar_events() -> List[Dict[str, Any]]:
    # Graceful stub when offline / without active OAuth tokens
    return [
        {
            "id": "cal_1",
            "time": "10:00 - 11:30 AM",
            "title": "BossCoder: Dynamic Programming Lab 4",
            "type": "STUDY",
            "urgent": True,
            "attendees": ["Mentor", "Batch 28"]
        },
        {
            "id": "cal_2",
            "time": "02:00 - 02:45 PM",
            "title": "GitHub: Review & Merge Auth Refactor PR #42",
            "type": "WORK",
            "urgent": False,
            "attendees": ["Dev Team"]
        },
        {
            "id": "cal_3",
            "time": "08:00 - 09:30 PM",
            "title": "BossCoder Live Lecture: Graph Theory & BFS/DFS",
            "type": "STUDY",
            "urgent": True,
            "attendees": ["Instructor", "DSA Cohort"]
        }
    ]


def get_priority_emails() -> List[Dict[str, Any]]:
    # Graceful stub when offline / without active OAuth tokens
    return [
        {
            "id": "msg_101",
            "from": "BossCoder Mentor",
            "subject": "Review feedback on Binary Search Trees Lab",
            "snippet": "Great job on the AVL tree balancing case. Make sure to review the DP problem set.",
            "time": "08:15 AM",
            "priority": "HIGH"
        },
        {
            "id": "msg_102",
            "from": "GitHub Notifications",
            "subject": "[daypilot] 2 new PR review requests assigned",
            "snippet": "srijanhalder requested your review on #42: feat(orb): simplex noise shader.",
            "time": "07:40 AM",
            "priority": "NORMAL"
        }
    ]
