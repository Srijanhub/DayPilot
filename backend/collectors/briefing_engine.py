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
    url: Optional[str] = None


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
    Synthesizes the morning briefing dynamically using live integration collectors.
    Generates real personalized mission plan blocks from live BossCoder, GitHub, and Gmail data.
    """
    quote_data = get_quote_of_the_day()
    calendar = get_calendar_events()
    emails = get_priority_emails()
    bosscoder = get_bosscoder_alerts()
    github = get_github_notifications()
    newspaper = get_morning_newspaper()

    # 1. Dynamically synthesize Priority Focus directive
    top_bc = bosscoder[0] if bosscoder else None
    top_gh = github[0] if github else None
    
    if top_gh and top_bc:
        priority_focus = f"Prioritize reviewing {top_gh.get('repo', 'GitHub')} {top_gh.get('pr', 'PR')} ({top_gh.get('title', '')[:45]}...) and advance {top_bc.get('title', 'BossCoder lecture')}."
    elif top_gh:
        priority_focus = f"Primary focus: Iterate and follow up on {top_gh.get('repo', 'GitHub')} {top_gh.get('pr', 'PR')}."
    elif top_bc:
        priority_focus = f"Primary study focus: Advance {top_bc.get('title', 'BossCoder topic')}."
    else:
        priority_focus = "Execution mode: Deep focus block on local engineering tasks."

    # 2. Dynamically build Schedule Blocks from real feeds
    schedule_blocks: List[ScheduleBlock] = []

    # Morning Block: BossCoder Study / DSA Lecture
    if bosscoder:
        active_lecture = next((b for b in bosscoder if b.get("type") == "LECTURE"), bosscoder[0])
        schedule_blocks.append(
            ScheduleBlock(
                time="10:00 - 11:45 AM",
                task=f"Deep Study: {active_lecture.get('title', 'BossCoder Lecture')}",
                mode="STUDY",
                url=active_lecture.get("url", "https://school.bosscoderacademy.com/curriculum")
            )
        )

    # Midday Block: Primary GitHub Open PR
    if github:
        primary_pr = github[0]
        schedule_blocks.append(
            ScheduleBlock(
                time="02:00 - 03:30 PM",
                task=f"Code Review: {primary_pr.get('repo', 'GitHub')} {primary_pr.get('pr', '')} ({primary_pr.get('title', '')[:35]}...)",
                mode="WORK",
                url=primary_pr.get("url", "https://github.com/notifications")
            )
        )

    # Afternoon Block: Secondary GitHub PR or Contest
    if len(github) > 1:
        sec_pr = github[1]
        schedule_blocks.append(
            ScheduleBlock(
                time="04:00 - 05:00 PM",
                task=f"PR Follow-up: {sec_pr.get('repo', 'GitHub')} {sec_pr.get('pr', '')}",
                mode="WORK",
                url=sec_pr.get("url", "https://github.com/notifications")
            )
        )
    elif len(bosscoder) > 1:
        sec_bc = bosscoder[1]
        schedule_blocks.append(
            ScheduleBlock(
                time="04:00 - 05:00 PM",
                task=f"Review: {sec_bc.get('title', 'BossCoder Module')}",
                mode="STUDY",
                url=sec_bc.get("url", "https://school.bosscoderacademy.com/curriculum")
            )
        )

    # Evening Block: Next Module or Contest
    contest = next((b for b in bosscoder if b.get("type") == "CONTEST"), None)
    if contest:
        schedule_blocks.append(
            ScheduleBlock(
                time="08:00 - 09:00 PM",
                task=f"Review Contest: {contest.get('title', 'Batch Contest')}",
                mode="STUDY",
                url=contest.get("url", "https://school.bosscoderacademy.com/contests")
            )
        )
    else:
        schedule_blocks.append(
            ScheduleBlock(
                time="08:00 - 09:00 PM",
                task="Evening Retrospective & Sync",
                mode="WORK",
                url="http://localhost:3000"
            )
        )

    newspaper_digest = [n["headline"] for n in newspaper]

    briefing = MorningBriefingSchema(
        morning_quote=quote_data["quote"],
        morning_quote_author=quote_data["author"],
        priority_focus=priority_focus,
        schedule_blocks=schedule_blocks,
        newspaper_digest=newspaper_digest,
        bosscoder_alerts=bosscoder,
        github_notifications=github,
        calendar_events=calendar,
        priority_emails=emails
    )

    return briefing
