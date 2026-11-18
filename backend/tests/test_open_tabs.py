import time
import asyncio
from fastapi.testclient import TestClient
import app as app_module
from app import app
from auth import DAYPILOT_API_TOKEN

client = TestClient(app)
H = {"X-DayPilot-Token": DAYPILOT_API_TOKEN}


def _reset():
    app_module._open_tabs.update(tabs=[], updated_at=0.0)


def test_open_tabs_empty_until_browser_reports():
    _reset()
    data = client.get("/api/tabs/open").json()
    assert data == {"connected": False, "tabs": [], "updated_at": 0.0}


def test_report_requires_token():
    assert client.post("/api/tabs/open", json={"tabs": []}).status_code == 401


def test_only_reported_web_tabs_are_returned():
    _reset()
    payload = {"tabs": [
        {"id": 1, "window_id": 1, "title": "Repo", "url": "https://github.com/x/y", "active": True, "focused": True},
        {"id": 2, "window_id": 1, "title": "Settings", "url": "chrome://settings", "active": False, "focused": False},
        {"id": 3, "window_id": 1, "title": "Ext", "url": "chrome-extension://abc/p.html", "active": False, "focused": False},
    ]}
    assert client.post("/api/tabs/open", json=payload, headers=H).json()["count"] == 1
    data = client.get("/api/tabs/open").json()
    assert data["connected"] is True
    assert [t["domain"] for t in data["tabs"]] == ["github.com"]
    assert data["tabs"][0]["focused"] is True


def test_closed_tab_disappears_on_next_report():
    _reset()
    two = {"tabs": [
        {"id": 1, "title": "A", "url": "https://a.com", "active": True, "focused": True},
        {"id": 2, "title": "B", "url": "https://b.com"},
    ]}
    client.post("/api/tabs/open", json=two, headers=H)
    one = {"tabs": [two["tabs"][0]]}
    client.post("/api/tabs/open", json=one, headers=H)
    assert [t["id"] for t in client.get("/api/tabs/open").json()["tabs"]] == [1]


def test_snapshot_expires_when_browser_stops_reporting():
    _reset()
    client.post("/api/tabs/open", json={"tabs": [{"id": 1, "title": "A", "url": "https://a.com"}]}, headers=H)
    app_module._open_tabs["updated_at"] = time.time() - (app_module.OPEN_TABS_TTL_SECONDS + 1)
    data = client.get("/api/tabs/open").json()
    assert data["connected"] is False and data["tabs"] == []
