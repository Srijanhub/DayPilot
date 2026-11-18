"""
DayPilot Morning Briefing Synthesizer Engine
Combines Calendar, Gmail, BossCoder, GitHub, Newspaper, and Quotes
into a validated Pydantic Briefing schema with pluggable LLM/Rule providers.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from collectors.quotes import get_quote_of_the_day
from collectors.google_suite import get_calendar_events, get_priority_emails
from collectors.bosscoder import get_bosscoder_alerts
from collectors.github_sync import get_github_notifications
from collectors.newspaper import get_morning_newspaper


class ScheduleBlock(BaseModel):
    time: str
    task: str
    mode: str = Field(description="WORK, STUDY, or RELAX")


class MorningBriefingSchema(BaseModel):
    morning_quote: str
    morning_quote_author: str
    priority_focus: str
    schedule_blocks: List[ScheduleBlock]
    newspaper_digest: List[str]
    bosscoder_alerts: List[Dict[str, Any]]
    github_notifications: List[Dict[str, Any]]
    calendar_events: List[Dict[str, Any]]
    priority_emails: List[Dict[str, Any]]


def synthesize_morning_briefing() -> MorningBriefingSchema:
    """
    Synthesizes the morning briefing using structured integration collectors.
    Validates output through Pydantic.
    """
    quote_data = get_quote_of_the_day()
    calendar = get_calendar_events()
    emails = get_priority_emails()
    bosscoder = get_bosscoder_alerts()
    github = get_github_notifications()
    newspaper = get_morning_newspaper()

    schedule_blocks = [
        ScheduleBlock(time="10:00 - 11:30 AM", task="Deep Work: BossCoder DP Lab 4 Submission", mode="STUDY"),
        ScheduleBlock(time="02:00 - 02:45 PM", task="Review GitHub PR #42 & merge", mode="WORK"),
        ScheduleBlock(time="08:00 - 09:30 PM", task="BossCoder Live Mentorship: Graph BFS/DFS", mode="STUDY")
    ]

    newspaper_digest = [n["headline"] for n in newspaper]

    briefing = MorningBriefingSchema(
        morning_quote=quote_data["quote"],
        morning_quote_author=quote_data["author"],
        priority_focus="Complete BossCoder DP Lab 4 & verify tree edge cases before 4:00 PM.",
        schedule_blocks=schedule_blocks,
        newspaper_digest=newspaper_digest,
        bosscoder_alerts=bosscoder,
        github_notifications=github,
        calendar_events=calendar,
        priority_emails=emails
    )

    return briefing
