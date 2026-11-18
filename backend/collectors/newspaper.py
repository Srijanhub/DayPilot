"""
DayPilot Live News Aggregator

Pulls real headlines from RSS/Atom feeds (concurrently, with conditional
requests), cleans and de-duplicates them, stores them in SQLite so the digest
survives restarts and works offline, and ranks them by freshness with source
diversity. Nothing is fabricated: if every feed fails and nothing is cached,
the digest is simply empty.

Configure feeds with NEWS_FEEDS in backend/.env, entries separated by ';':
    NEWS_FEEDS=TECH|BBC Technology|https://feeds.bbci.co.uk/news/technology/rss.xml;DEV|Hacker News|https://hnrss.org/frontpage
"""

import asyncio
import calendar
import hashlib
import html
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import feedparser
import httpx

from database import get_db_connection

DEFAULT_FEEDS: List[Dict[str, str]] = [
    {"topic": "TECH", "name": "BBC Technology", "url": "https://feeds.bbci.co.uk/news/technology/rss.xml"},
    {"topic": "TECH", "name": "Ars Technica", "url": "https://feeds.arstechnica.com/arstechnica/index"},
    {"topic": "TECH", "name": "MIT Technology Review", "url": "https://www.technologyreview.com/feed/"},
    {"topic": "DEV", "name": "Hacker News", "url": "https://hnrss.org/frontpage?points=150"},
    {"topic": "DEV", "name": "GitHub Blog", "url": "https://github.blog/feed/"},
    {"topic": "DEV", "name": "DEV Community", "url": "https://dev.to/feed"},
    {"topic": "WORLD", "name": "BBC World", "url": "https://feeds.bbci.co.uk/news/world/rss.xml"},
    {"topic": "INDIA", "name": "The Hindu", "url": "https://www.thehindu.com/news/national/feeder/default.rss"},
    {"topic": "INDIA", "name": "Times of India", "url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"},
]

MAX_AGE_HOURS = float(os.environ.get("NEWS_MAX_AGE_HOURS", "36"))
PER_FEED_LIMIT = int(os.environ.get("NEWS_PER_FEED", "15"))
MIN_REFRESH_INTERVAL = 15          # seconds between manual refreshes
STALE_AFTER_SECONDS = 45 * 60
NEW_BADGE_SECONDS = 2 * 3600
RETENTION_SECONDS = 7 * 24 * 3600
MAX_FEED_BYTES = 3 * 1024 * 1024
USER_AGENT = "DayPilot/1.0 (local news reader)"

_TRACKING_PARAMS = {"fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "ocid", "cmpid", "at_medium", "at_campaign"}

_http_cache: Dict[str, Dict[str, str]] = {}   # feed url -> {"etag", "last_modified"}
_feed_status: List[Dict[str, Any]] = []
_last_fetch: float = 0.0
_lock: Optional[asyncio.Lock] = None


# --------------------------------------------------------------------------- config

def load_feeds() -> List[Dict[str, str]]:
    raw = os.environ.get("NEWS_FEEDS", "").strip()
    if not raw:
        return list(DEFAULT_FEEDS)
    feeds = []
    for entry in raw.split(";"):
        parts = [p.strip() for p in entry.split("|")]
        if len(parts) == 3 and parts[2].startswith(("http://", "https://")):
            feeds.append({"topic": parts[0].upper(), "name": parts[1], "url": parts[2]})
    return feeds or list(DEFAULT_FEEDS)


# --------------------------------------------------------------------------- cleaning

def canonical_url(url: str) -> Optional[str]:
    """http(s) only; strips fragments and tracking parameters."""
    try:
        p = urlparse((url or "").strip())
    except ValueError:
        return None
    if p.scheme.lower() not in ("http", "https") or not p.netloc:
        return None
    query = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
             if not k.lower().startswith("utm_") and k.lower() not in _TRACKING_PARAMS]
    return urlunparse((p.scheme.lower(), p.netloc.lower(), p.path or "/", "", urlencode(query), ""))


def clean_text(raw: str) -> str:
    text = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", raw or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s*The post .{0,200}? appeared first on .{0,100}$", "", text, flags=re.I)
    text = re.sub(r"\s*\[(?:…|\.\.\.)\]\s*$", "…", text)
    return text


def make_summary(text: str, title: str, limit: int = 320) -> str:
    if not text or text.strip().lower() == title.strip().lower():
        return ""
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    if end >= 120:
        return cut[:end + 1]
    space = cut.rfind(" ")
    return (cut[:space] if space > 0 else cut).rstrip(",;:- ") + "…"


def title_key(title: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", title.lower()))


def article_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


def normalize_entry(entry: Any, feed: Dict[str, str], now: float) -> Optional[Dict[str, Any]]:
    title = clean_text(entry.get("title", ""))
    url = canonical_url(entry.get("link", ""))
    if not title or not url:
        return None

    body = entry.get("summary", "") or ""
    if not body and entry.get("content"):
        body = entry["content"][0].get("value", "")
    text = clean_text(body)

    discussion_url = None
    points = re.search(r"Points:\s*(\d+)", text)
    if points:  # Hacker News style feed: description is metadata, not prose
        comments = re.search(r"#\s*Comments:\s*(\d+)", text)
        text = f"{points.group(1)} points · {comments.group(1) if comments else 0} comments on Hacker News"
        discussion_url = canonical_url(entry.get("comments", ""))

    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    published = float(calendar.timegm(parsed)) if parsed else now
    published = min(published, now)   # never let a bad feed date pin an item to the top

    return {
        "id": article_id(url),
        "url": url,
        "title": title[:300],
        "summary": make_summary(text, title),
        "source": feed["name"],
        "topic": feed["topic"],
        "discussion_url": discussion_url,
        "published": published,
    }


# --------------------------------------------------------------------------- fetching

async def _fetch_feed(client: httpx.AsyncClient, feed: Dict[str, str]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    status = {"name": feed["name"], "topic": feed["topic"], "url": feed["url"],
              "ok": False, "count": 0, "error": None, "not_modified": False}
    headers = {}
    cached = _http_cache.get(feed["url"], {})
    if cached.get("etag"):
        headers["If-None-Match"] = cached["etag"]
    if cached.get("last_modified"):
        headers["If-Modified-Since"] = cached["last_modified"]
    try:
        resp = await client.get(feed["url"], headers=headers)
        if resp.status_code == 304:
            status.update(ok=True, not_modified=True)
            return status, []
        resp.raise_for_status()
        if len(resp.content) > MAX_FEED_BYTES:
            raise ValueError("feed too large")
        # Always parse bytes: feedparser would treat a str as a URL and fetch it itself.
        parsed = await asyncio.to_thread(feedparser.parse, resp.content)
        if not parsed.entries:
            raise ValueError("no entries in feed")
        _http_cache[feed["url"]] = {"etag": resp.headers.get("etag", ""),
                                    "last_modified": resp.headers.get("last-modified", "")}
        now = time.time()
        items = [i for i in (normalize_entry(e, feed, now) for e in parsed.entries[:PER_FEED_LIMIT]) if i]
        status.update(ok=True, count=len(items))
        return status, items
    except Exception as exc:  # one dead feed must never break the digest
        status["error"] = f"{type(exc).__name__}: {str(exc)[:100]}"
        return status, []


def _store(items: List[Dict[str, Any]], now: float) -> int:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        new_count = 0
        for it in items:
            if not cur.execute("SELECT 1 FROM news_articles WHERE id = ?;", (it["id"],)).fetchone():
                new_count += 1
            cur.execute("""
                INSERT INTO news_articles (id, url, title, summary, source, topic, discussion_url, published, first_seen, last_seen)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title, summary = excluded.summary,
                    discussion_url = excluded.discussion_url, last_seen = excluded.last_seen;
            """, (it["id"], it["url"], it["title"], it["summary"], it["source"], it["topic"],
                  it["discussion_url"], it["published"], now, now))
        cur.execute("DELETE FROM news_articles WHERE last_seen < ?;", (now - RETENTION_SECONDS,))
        conn.commit()
        return new_count
    finally:
        conn.close()


async def refresh_news(feeds: Optional[List[Dict[str, str]]] = None,
                       client: Optional[httpx.AsyncClient] = None,
                       force: bool = False) -> Dict[str, Any]:
    """Fetch all feeds now and store the results. Returns a small report."""
    global _last_fetch, _feed_status, _lock
    now = time.time()
    if not force and feeds is None and _last_fetch and now - _last_fetch < MIN_REFRESH_INTERVAL:
        return {"throttled": True, "new": 0, "ok_feeds": sum(1 for s in _feed_status if s["ok"]), "total_feeds": len(_feed_status)}

    if _lock is None:
        _lock = asyncio.Lock()
    async with _lock:
        feeds = feeds if feeds is not None else load_feeds()
        own_client = client is None
        if own_client:
            client = httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(8.0),
                                       headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"})
        try:
            results = await asyncio.gather(*(_fetch_feed(client, f) for f in feeds))
        finally:
            if own_client:
                await client.aclose()

        statuses = [s for s, _ in results]
        items = [i for _, batch in results for i in batch]
        new_count = await asyncio.to_thread(_store, items, time.time()) if items else 0
        _feed_status = statuses
        if any(s["ok"] for s in statuses):
            _last_fetch = time.time()
        return {"throttled": False, "new": new_count,
                "ok_feeds": sum(1 for s in statuses if s["ok"]), "total_feeds": len(statuses)}


# --------------------------------------------------------------------------- ranking & reading

def rank_articles(rows: List[Dict[str, Any]], now: float, limit: int,
                  topic: Optional[str] = None, max_age_hours: float = MAX_AGE_HOURS) -> List[Dict[str, Any]]:
    """Newest first, de-duplicated by title, then spread across sources and topics."""
    pool, seen = [], set()
    for r in sorted(rows, key=lambda r: -r["published"]):
        if now - r["published"] > max_age_hours * 3600:
            continue
        if topic and r["topic"] != topic:
            continue
        key = title_key(r["title"])
        if key in seen:
            continue
        seen.add(key)
        pool.append(r)

    def base(r):
        return 1.0 / (1.0 + max(0.0, now - r["published"]) / 3600.0 / 8.0)

    picked, per_source, per_topic = [], {}, {}
    while pool and len(picked) < limit:
        best = max(pool, key=lambda r: base(r) - 0.12 * per_source.get(r["source"], 0) - (0 if topic else 0.05 * per_topic.get(r["topic"], 0)))
        pool.remove(best)
        picked.append(best)
        per_source[best["source"]] = per_source.get(best["source"], 0) + 1
        per_topic[best["topic"]] = per_topic.get(best["topic"], 0) + 1
    return picked


def _read_rows() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        return [dict(r) for r in conn.execute("SELECT * FROM news_articles;").fetchall()]
    finally:
        conn.close()


def _serialize(r: Dict[str, Any], now: float) -> Dict[str, Any]:
    return {
        "id": r["id"], "title": r["title"], "summary": r["summary"] or "", "source": r["source"],
        "topic": r["topic"], "url": r["url"], "discussion_url": r["discussion_url"],
        "published": datetime.fromtimestamp(r["published"], tz=timezone.utc).isoformat().replace("+00:00", "Z"),
        "published_ts": r["published"],
        "is_new": (now - r["first_seen"]) <= NEW_BADGE_SECONDS,
    }


def get_news_payload(topic: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
    now = time.time()
    rows = _read_rows()
    topic = topic.upper() if topic else None
    topics: Dict[str, int] = {}
    for r in rank_articles(rows, now, limit=10_000):
        topics[r["topic"]] = topics.get(r["topic"], 0) + 1
    by_id = {r["id"]: r for r in rows}
    articles = [_serialize(by_id[r["id"]], now) for r in rank_articles(rows, now, limit, topic)]
    fetched_at = _last_fetch or (max((r["last_seen"] for r in rows), default=0.0) or None)
    return {
        "articles": articles,
        "topics": topics,
        "fetched_at": fetched_at,
        "stale": fetched_at is None or (now - fetched_at) > STALE_AFTER_SECONDS,
        "feeds": [{k: s[k] for k in ("name", "topic", "ok", "count", "error", "not_modified")} for s in _feed_status],
        "configured_feeds": len(load_feeds()),
    }


def get_morning_newspaper(limit: int = 5) -> List[Dict[str, Any]]:
    """Cached top stories for the morning briefing (no network; empty if nothing cached)."""
    now = time.time()
    rows = _read_rows()
    return [
        {"topic": r["topic"], "category": r["topic"], "headline": r["title"], "summary": r["summary"] or "",
         "source": r["source"], "url": r["url"], "time": datetime.fromtimestamp(r["published"]).strftime("%H:%M")}
        for r in rank_articles(rows, now, limit)
    ]
