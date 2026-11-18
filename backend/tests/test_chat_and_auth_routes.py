import pytest
from fastapi.testclient import TestClient
from app import app
from auth import DAYPILOT_API_TOKEN

client = TestClient(app)


def test_greeting_no_substring_false_positives():
    """Verify that 'this' or 'which' does NOT trigger the greeting reply."""
    headers = {"X-DayPilot-Token": DAYPILOT_API_TOKEN}

    # Query containing 'this'
    res1 = client.post("/api/chat", json={"message": "Is this approach fine?"}, headers=headers)
    assert res1.status_code == 200
    reply1 = res1.json()["reply"]
    assert "Greetings" not in reply1
    assert "DayPilot Copilot is online and connected to your cockpit" not in reply1

    # Query containing 'which'
    res2 = client.post("/api/chat", json={"message": "Which class should I take?"}, headers=headers)
    assert res2.status_code == 200
    reply2 = res2.json()["reply"]
    assert "Greetings" not in reply2

    # Legitimate greeting 'hi'
    res_hi = client.post("/api/chat", json={"message": "hi"}, headers=headers)
    assert res_hi.status_code == 200
    reply_hi = res_hi.json()["reply"]
    assert "Greetings" in reply_hi

    # Legitimate greeting 'hello'
    res_hello = client.post("/api/chat", json={"message": "Hello!"}, headers=headers)
    assert res_hello.status_code == 200
    reply_hello = res_hello.json()["reply"]
    assert "Greetings" in reply_hello


def test_state_changing_routes_require_auth(monkeypatch):
    """Verify all state-changing endpoints reject requests lacking valid token."""
    # Mock external network triggers so unit test runs fast
    async def mock_sync_all():
        return {"status": "ok", "mocked": True}

    from unified_syncer import sync_engine
    monkeypatch.setattr(sync_engine, "sync_all_now", mock_sync_all)

    state_changing_calls = [
        ("POST", "/api/chat", {"message": "hello"}),
        ("POST", "/api/open-url", {"url": "https://example.com"}),
        ("POST", "/api/sync/all", None),
        ("POST", "/api/heartbeat", {"app_name": "Test"}),
        ("POST", "/api/context/override", {"mode": "FORCE_WORK"}),
        ("POST", "/api/bookmarks/sync-history", None),
    ]

    for method, path, payload in state_changing_calls:
        # 1. No token header -> 401
        res = client.request(method, path, json=payload)
        assert res.status_code == 401, f"Expected 401 for unauthenticated {path}, got {res.status_code}"

        # 2. Invalid token header -> 401
        res_bad = client.request(method, path, json=payload, headers={"X-DayPilot-Token": "invalid_fake_token"})
        assert res_bad.status_code == 401, f"Expected 401 for invalid token {path}, got {res_bad.status_code}"

        # 3. Valid token header -> NOT 401
        res_ok = client.request(method, path, json=payload, headers={"X-DayPilot-Token": DAYPILOT_API_TOKEN})
        assert res_ok.status_code != 401, f"Expected authorized response for {path}, got 401"
