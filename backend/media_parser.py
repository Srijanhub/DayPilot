"""
DayPilot Media Parser
Extracts structured media metadata (MANHWA, ANIME, SHOW) from tab titles and URLs.
"""

import re
from typing import Optional, Dict, Any


def parse_media_info(
    window_title: Optional[str] = None,
    domain: Optional[str] = None,
    url: Optional[str] = None,
    explicit_media_type: Optional[str] = None,
    explicit_series_title: Optional[str] = None,
    explicit_unit_label: Optional[str] = None,
    timestamp_offset: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Parses media metadata from explicit payload fields or heuristics on window title, domain, and URL.
    Returns a dict with:
        media_type: 'MANHWA' | 'ANIME' | 'SHOW'
        title: series name
        current_unit: 'Chapter 76', 'S02 E04', 'Episode 14', etc.
        resume_url: string
        timestamp_offset: optional string
    Or None if not a recognized media item.
    """
    # 1. Explicit metadata provided by extension or player
    if explicit_media_type and explicit_series_title and explicit_unit_label:
        m_type = explicit_media_type.upper().strip()
        if m_type not in ('MANHWA', 'MANGA', 'SHOW', 'ANIME'):
            m_type = "SHOW"
        return {
            "media_type": m_type,
            "title": explicit_series_title.strip(),
            "current_unit": explicit_unit_label.strip(),
            "timestamp_offset": timestamp_offset,
            "resume_url": (url or "").strip()
        }

    # 2. Heuristic extraction from window title and domain
    if not window_title:
        return None

    title_raw = window_title.strip()
    title_lower = title_raw.lower()
    domain_str = (domain or "").lower()
    url_str = (url or "").strip()

    chap_match = re.search(r'(?:chapter|ch\.?)\s*(\d+(?:\.\d+)?)', title_lower, re.IGNORECASE)
    season_ep_match = re.search(r'(?:s(\d+)\s*e(\d+)|season\s*(\d+).*?episode\s*(\d+))', title_lower, re.IGNORECASE)
    ep_match = re.search(r'(?:episode|ep\.?)\s*(\d+)', title_lower, re.IGNORECASE)

    is_manhwa = any(k in title_lower or k in domain_str for k in [
        "manhwa", "manga", "manhua", "comic", "asura", "flame", "toon", "reaper", "webtoon", "scan"
    ])
    is_anime = any(k in title_lower or k in domain_str for k in [
        "crunchyroll", "aniwatch", "hianime", "9anime", "gogoanime", "animepahe", "anime"
    ])
    is_show = any(k in title_lower or k in domain_str for k in [
        "netflix", "primevideo", "hotstar", "disneyplus", "hulu", "max.com", "appletv"
    ])
    is_youtube = ("youtube.com" in domain_str or "- youtube" in title_lower) and "music.youtube" not in domain_str

    # A. Manhwa / Manga / Webtoons
    if chap_match and is_manhwa:
        chap_num = chap_match.group(1)
        parts = re.split(r'[-–|]', title_raw)
        series_name = parts[0].strip()
        if series_name:
            return {
                "media_type": "MANHWA",
                "title": series_name,
                "current_unit": f"Chapter {chap_num}",
                "timestamp_offset": None,
                "resume_url": url_str
            }

    # B. Anime
    if (season_ep_match or ep_match) and is_anime:
        unit_str = (
            f"S{season_ep_match.group(1) or season_ep_match.group(3)} E{season_ep_match.group(2) or season_ep_match.group(4)}"
            if season_ep_match else f"Episode {ep_match.group(1)}"
        )
        t_clean = re.sub(r'^(?:watch\s+)', '', title_raw, flags=re.IGNORECASE)
        t_clean = re.sub(r'(?:english\s+subbed|english\s+dubbed|on\s+hianime\.to|on\s+crunchyroll|\bon\s+[\w\.-]+)', '', t_clean, flags=re.IGNORECASE)
        t_clean = re.sub(r'(?:s\d+\s*e\d+|season\s*\d+.*?episode\s*\d+|episode\s*\d+|ep\.?\s*\d+).*$', '', t_clean, flags=re.IGNORECASE)
        parts = re.split(r'[-–|]', t_clean)
        series_name = parts[0].strip()
        if series_name:
            return {
                "media_type": "ANIME",
                "title": series_name,
                "current_unit": unit_str,
                "timestamp_offset": None,
                "resume_url": url_str
            }

    # C. TV Shows / Series
    if (season_ep_match or ep_match) and is_show:
        unit_str = (
            f"S{season_ep_match.group(1) or season_ep_match.group(3)} E{season_ep_match.group(2) or season_ep_match.group(4)}"
            if season_ep_match else f"Episode {ep_match.group(1)}"
        )
        t_clean = re.sub(r'(?:-\s*netflix|-\s*prime\s*video|-\s*disney\+.*|-\s*hotstar).*$', '', title_raw, flags=re.IGNORECASE)
        parts = re.split(r'[-–|:]', t_clean)
        series_name = parts[0].strip()
        if series_name:
            return {
                "media_type": "SHOW",
                "title": series_name,
                "current_unit": unit_str,
                "timestamp_offset": None,
                "resume_url": url_str
            }

    # D. YouTube Video / Educational or Entertainment Series
    if is_youtube and len(title_raw) > 3:
        cleaned_title = re.sub(r'\s*-\s*YouTube\s*$', '', title_raw, flags=re.IGNORECASE).strip()
        unit_str = "Video"
        if season_ep_match:
            unit_str = f"S{season_ep_match.group(1) or season_ep_match.group(3)} E{season_ep_match.group(2) or season_ep_match.group(4)}"
        elif ep_match:
            unit_str = f"Episode {ep_match.group(1)}"
        elif re.search(r'part\s*(\d+)', title_lower):
            p_m = re.search(r'part\s*(\d+)', title_lower)
            unit_str = f"Part {p_m.group(1)}"

        if cleaned_title:
            return {
                "media_type": "SHOW",
                "title": cleaned_title,
                "current_unit": unit_str,
                "timestamp_offset": None,
                "resume_url": url_str
            }

    return None
