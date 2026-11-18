import pytest
from media_parser import parse_media_info


def test_explicit_media_telemetry():
    result = parse_media_info(
        explicit_media_type="MANHWA",
        explicit_series_title="Solo Leveling",
        explicit_unit_label="Chapter 179",
        timestamp_offset=None,
        url="https://asuracomic.net/series/solo-leveling/chapter-179"
    )
    assert result is not None
    assert result["media_type"] == "MANHWA"
    assert result["title"] == "Solo Leveling"
    assert result["current_unit"] == "Chapter 179"
    assert result["resume_url"] == "https://asuracomic.net/series/solo-leveling/chapter-179"


def test_heuristic_manhwa_title():
    result = parse_media_info(
        window_title="Academy's Genius Swordsman Chapter 76 - Asura Scans",
        domain="asuracomic.net",
        url="https://asuracomic.net/series/academys-genius-swordsman/chapter-76"
    )
    assert result is not None
    assert result["media_type"] == "MANHWA"
    assert "Academy's Genius Swordsman" in result["title"]
    assert result["current_unit"] == "Chapter 76"


def test_heuristic_anime_title():
    result = parse_media_info(
        window_title="Watch Jujutsu Kaisen Episode 14 English Subbed on HiAnime.to",
        domain="hianime.to",
        url="https://hianime.to/watch/jujutsu-kaisen-episode-14"
    )
    assert result is not None
    assert result["media_type"] == "ANIME"
    assert "Jujutsu Kaisen" in result["title"]
    assert result["current_unit"] == "Episode 14"


def test_heuristic_netflix_show():
    result = parse_media_info(
        window_title="Arcane: Season 2 Episode 4 - Netflix",
        domain="netflix.com",
        url="https://www.netflix.com/watch/12345"
    )
    assert result is not None
    assert result["media_type"] == "SHOW"
    assert "Arcane" in result["title"]
    assert "S2 E4" in result["current_unit"] or "Episode 4" in result["current_unit"]


def test_non_media_window():
    result = parse_media_info(
        window_title="daypilot/backend/app.py - Visual Studio Code",
        domain="localhost",
        url="http://localhost:3000"
    )
    assert result is None
