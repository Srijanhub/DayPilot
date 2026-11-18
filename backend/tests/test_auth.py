import os
import pytest
from pathlib import Path
from fastapi import HTTPException
from auth import (
    DEFAULT_DISALLOWED_TOKEN,
    get_or_create_daypilot_token,
    verify_daypilot_token,
    DAYPILOT_API_TOKEN
)


def test_default_token_fails_startup(monkeypatch):
    monkeypatch.setenv("DAYPILOT_API_TOKEN", DEFAULT_DISALLOWED_TOKEN)
    with pytest.raises(RuntimeError) as exc_info:
        get_or_create_daypilot_token()
    assert "Disallowed insecure default token" in str(exc_info.value)


def test_token_file_generation_and_reading(tmp_path, monkeypatch):
    test_token_file = tmp_path / "token"
    monkeypatch.delenv("DAYPILOT_API_TOKEN", raising=False)
    monkeypatch.setattr("auth.TOKEN_DIR", tmp_path)
    monkeypatch.setattr("auth.TOKEN_FILE", test_token_file)

    tok1 = get_or_create_daypilot_token()
    assert len(tok1) == 64  # 32 bytes hex
    assert test_token_file.exists()
    assert test_token_file.read_text().strip() == tok1

    # Reading existing file returns same token
    tok2 = get_or_create_daypilot_token()
    assert tok2 == tok1


def test_verify_token_dependency():
    # Missing header raises 401
    with pytest.raises(HTTPException) as exc1:
        verify_daypilot_token(None)
    assert exc1.value.status_code == 401

    # Wrong header raises 401
    with pytest.raises(HTTPException) as exc2:
        verify_daypilot_token("wrong_token")
    assert exc2.value.status_code == 401

    # Correct header passes without exception
    verify_daypilot_token(DAYPILOT_API_TOKEN)
