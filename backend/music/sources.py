"""
DayPilot Music Source Abstraction
Provides pluggable audio streaming adapters:
1. LocalMusicAdapter: Plays offline user audio tracks.
2. YouTubeExtensionAdapter: Commands the browser extension via MediaSession.
3. PipedStreamAdapter: Resolves audio stream URLs for HTML5 player.
   NOTE: Extracting streams directly from YouTube may conflict with YouTube Terms of Service.
   This adapter is isolated and optional.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


class MusicSource(ABC):
    @abstractmethod
    def search_track(self, query: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def resolve_audio_stream(self, track_id: str) -> Optional[str]:
        pass


class LocalMusicAdapter(MusicSource):
    def search_track(self, query: str) -> List[Dict[str, Any]]:
        # Searches local ~/daypilot/music/ folder
        return [
            {"id": "loc_1", "title": "Synthwave Focus", "artist": "Local Artist", "source": "LOCAL"}
        ]

    def resolve_audio_stream(self, track_id: str) -> Optional[str]:
        return "/api/music/stream/loc_1"


class YouTubeExtensionAdapter(MusicSource):
    def search_track(self, query: str) -> List[Dict[str, Any]]:
        return [
            {"id": "yt_ext_1", "title": query, "artist": "YouTube Music", "source": "EXTENSION_RELAY"}
        ]

    def resolve_audio_stream(self, track_id: str) -> Optional[str]:
        # Extension plays directly in music.youtube.com tab
        return None


class PipedStreamAdapter(MusicSource):
    """
    Experimental Piped API Audio Stream Adapter.
    Note: Direct audio streaming without ads.
    """
    def search_track(self, query: str) -> List[Dict[str, Any]]:
        return [
            {"id": "piped_1", "title": f"Stream: {query}", "artist": "Curated Stream", "source": "PIPED"}
        ]

    def resolve_audio_stream(self, track_id: str) -> Optional[str]:
        return "https://piped.video/api/stream/placeholder"
