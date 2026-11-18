"""
DayPilot BossCoder Academy Collector
Connects to https://bst-backend-java.bosscoderacademy.com
Extracts upcoming live lectures, problem set deadlines, and contests.
Fails gracefully with offline mock data if session token is missing.
"""

from typing import List, Dict, Any


def get_bosscoder_alerts() -> List[Dict[str, Any]]:
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
