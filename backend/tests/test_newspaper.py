import asyncio
import time
from email.utils import format_datetime
from datetime import datetime, timedelta, timezone

import httpx
import pytest

import database
from collectors import newspaper as news


@pytest.fixture(autouse=True)
def tmp_db(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DATA_DIR", tmp_path)
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "t.db")
    database.init_db()
    news._http_cache.clear()
    news._feed_status = []
    news._last_fetch = 0.0
    yield


def rfc(hours_ago):
    return format_datetime(datetime.now(timezone.utc) - timedelta(hours=hours_ago))


def rss(items):
    body = "".join(
        f"<item><title>{t}</title><link>{l}</link><description><![CDATA[{d}]]></description><pubDate>{rfc(h)}</pubDate>{extra}</item>"
        for t, l, d, h, extra in items
    )
    return f'<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>{body}</channel></rss>'


def feed(name, url="https://a.test/rss", topic="TECH"):
    return {"topic": topic, "name": name, "url": url}


def client_for(routes):
    def handler(req):
        r = routes.get(str(req.url))
        if r is None:
            return httpx.Response(404)
        if callable(r):
            return r(req)
        return httpx.Response(200, text=r, headers={"etag": '"v1"'})
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def run(coro):
    return asyncio.run(coro)


def test_parses_cleans_and_canonicalizes():
    xml = rss([("Big <b>launch</b>", "https://a.test/p?utm_source=x&id=7#frag",
                "<p>Fast &amp; <i>good</i>. " + "More detail here. " * 40 + "</p>", 1, "")])
    async def go():
        async with client_for({"https://a.test/rss": xml}) as c:
            return await news.refresh_news([feed("A")], c, force=True)
    assert run(go())["new"] == 1
    a = news.get_news_payload()["articles"][0]
    assert a["title"] == "Big launch"
    assert a["url"] == "https://a.test/p?id=7"
    assert "<" not in a["summary"] and "&amp;" not in a["summary"]
    assert len(a["summary"]) <= 325 and a["is_new"] is True


def test_hacker_news_metadata_becomes_readable_summary():
    desc = "<p>Article URL: x</p><p>Points: 321</p><p># Comments: 88</p>"
    xml = rss([("Show HN: thing", "https://hn.test/a", desc, 2, "<comments>https://news.ycombinator.com/item?id=1</comments>")])
    async def go():
        async with client_for({"https://a.test/rss": xml}) as c:
            await news.refresh_news([feed("Hacker News", topic="DEV")], c, force=True)
    run(go())
    a = news.get_news_payload()["articles"][0]
    assert a["summary"] == "321 points · 88 comments on Hacker News"
    assert a["discussion_url"].startswith("https://news.ycombinator.com/item")


def test_rejects_non_http_links_and_old_or_future_items():
    xml = rss([("Evil", "javascript:alert(1)", "", 1, ""),
               ("Ancient", "https://a.test/old", "", 100, ""),
               ("Future", "https://a.test/fut", "", -48, ""),
               ("Fine", "https://a.test/ok", "", 3, "")])
    async def go():
        async with client_for({"https://a.test/rss": xml}) as c:
            await news.refresh_news([feed("A")], c, force=True)
    run(go())
    titles = [a["title"] for a in news.get_news_payload()["articles"]]
    assert "Evil" not in titles and "Ancient" not in titles
    assert set(titles) == {"Fine", "Future"}
    fut = next(a for a in news.get_news_payload()["articles"] if a["title"] == "Future")
    assert fut["published_ts"] <= time.time()


def test_one_dead_feed_does_not_break_the_others():
    good = rss([("Works", "https://g.test/1", "", 1, "")])
    routes = {"https://g.test/rss": good, "https://b.test/rss": lambda r: httpx.Response(500)}
    async def go():
        async with client_for(routes) as c:
            return await news.refresh_news([feed("Good", "https://g.test/rss"), feed("Bad", "https://b.test/rss")], c, force=True)
    rep = run(go())
    assert (rep["ok_feeds"], rep["total_feeds"]) == (1, 2)
    payload = news.get_news_payload()
    bad = next(f for f in payload["feeds"] if f["name"] == "Bad")
    assert bad["ok"] is False and "500" in bad["error"]
    assert [a["title"] for a in payload["articles"]] == ["Works"]


def test_same_story_from_two_sources_is_shown_once():
    a = rss([("Chip maker wins big deal", "https://a.test/1", "", 2, "")])
    b = rss([("Chip Maker Wins Big Deal!", "https://b.test/9", "", 1, "")])
    async def go():
        async with client_for({"https://a.test/rss": a, "https://b.test/rss": b}) as c:
            await news.refresh_news([feed("A", "https://a.test/rss"), feed("B", "https://b.test/rss")], c, force=True)
    run(go())
    assert len(news.get_news_payload()["articles"]) == 1


def test_offline_keeps_cached_news_and_never_invents_any():
    assert news.get_news_payload()["articles"] == [] and news.get_morning_newspaper() == []
    xml = rss([("Cached story", "https://a.test/c", "", 1, "")])
    async def online():
        async with client_for({"https://a.test/rss": xml}) as c:
            await news.refresh_news([feed("A")], c, force=True)
    async def offline():
        async with client_for({}) as c:
            return await news.refresh_news([feed("A")], c, force=True)
    run(online())
    assert run(offline())["ok_feeds"] == 0
    assert [a["title"] for a in news.get_news_payload()["articles"]] == ["Cached story"]
    assert news.get_morning_newspaper()[0]["headline"] == "Cached story"


def test_conditional_request_and_304_keep_articles():
    xml = rss([("Story", "https://a.test/s", "", 1, "")])
    seen = []
    def handler(req):
        seen.append(req.headers.get("if-none-match"))
        return httpx.Response(304) if req.headers.get("if-none-match") else httpx.Response(200, text=xml, headers={"etag": '"abc"'})
    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            await news.refresh_news([feed("A")], c, force=True)
            return await news.refresh_news([feed("A")], c, force=True)
    rep = run(go())
    assert seen == [None, '"abc"'] and rep["ok_feeds"] == 1
    assert len(news.get_news_payload()["articles"]) == 1


def test_ranking_spreads_across_sources():
    now = time.time()
    rows = [{"id": str(i), "title": f"Flood {i}", "source": "Loud", "topic": "TECH", "published": now - i * 60} for i in range(10)]
    rows.append({"id": "q", "title": "Quiet one", "source": "Quiet", "topic": "WORLD", "published": now - 3 * 3600})
    top = [r["source"] for r in news.rank_articles(rows, now, 4)]
    assert "Quiet" in top


def test_api_shape_and_refresh_requires_token():
    from fastapi.testclient import TestClient
    from app import app
    c = TestClient(app)
    data = c.get("/api/news").json()
    assert set(data) >= {"articles", "topics", "fetched_at", "stale", "feeds", "configured_feeds"}
    assert data["articles"] == [] and data["stale"] is True
    assert c.post("/api/news/refresh").status_code == 401
