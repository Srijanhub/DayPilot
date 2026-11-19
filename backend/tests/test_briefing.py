"""
Unit tests for DayPilot Morning Briefing Synthesizer & Schema Validation
"""

import pytest
from collectors.briefing_engine import synthesize_morning_briefing, MorningBriefingSchema


def test_morning_briefing_schema(monkeypatch):
    sample = [{"headline": f"Story {i}", "topic": "TECH", "source": "Test", "url": f"https://example.com/{i}"} for i in range(3)]
    monkeypatch.setattr("collectors.briefing_engine.get_morning_newspaper", lambda *a, **k: sample)
    monkeypatch.setattr("collectors.briefing_engine.get_bosscoder_alerts", lambda *a, **k: [{"id": "bc_1", "title": "Dynamic Programming", "urgency": "HIGH"}])
    briefing = synthesize_morning_briefing()
    assert isinstance(briefing, MorningBriefingSchema)
    assert len(briefing.morning_quote) > 0
    assert len(briefing.schedule_blocks) >= 3
    assert len(briefing.newspaper_digest) >= 3
    assert len(briefing.bosscoder_alerts) >= 1
    assert len(briefing.calendar_events) >= 1

    # Check serialization
    data = briefing.model_dump()
    assert "priority_focus" in data
    assert "newspaper_digest" in data
