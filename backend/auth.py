"""
DayPilot Authentication & Security Module
Cryptographically secure token management and validation.
Tokens are dynamically generated and persisted in ~/daypilot/token.
"""

import os
import secrets
from pathlib import Path
from typing import Optional
from fastapi import HTTPException, Header

DEFAULT_DISALLOWED_TOKEN = "daypilot_local_sec_994b7a2d"
TOKEN_DIR = Path.home() / "daypilot"
TOKEN_FILE = TOKEN_DIR / "token"


def get_or_create_daypilot_token() -> str:
    """
    Retrieves or generates a secure API token stored in ~/daypilot/token.
    Enforces that the default insecure token is never used.
    """
    env_token = os.environ.get("DAYPILOT_API_TOKEN", "").strip()

    # 1. Enforce rejection of default weak token
    if env_token == DEFAULT_DISALLOWED_TOKEN:
        raise RuntimeError(
            f"[SECURITY CRITICAL] Disallowed insecure default token '{DEFAULT_DISALLOWED_TOKEN}' "
            "detected in environment. Please remove DAYPILOT_API_TOKEN from your .env file to "
            f"automatically generate a secure random token in {TOKEN_FILE}."
        )

    # 2. Check ~/daypilot/token file
    if TOKEN_FILE.exists():
        try:
            file_token = TOKEN_FILE.read_text().strip()
            if file_token == DEFAULT_DISALLOWED_TOKEN:
                raise RuntimeError(
                    f"[SECURITY CRITICAL] Insecure default token '{DEFAULT_DISALLOWED_TOKEN}' "
                    f"found in {TOKEN_FILE}. Delete this file or replace it with a secure token."
                )
            if file_token:
                return file_token
        except Exception as e:
            if isinstance(e, RuntimeError):
                raise

    # 3. If env var provides a valid custom token, persist it
    if env_token:
        TOKEN_DIR.mkdir(parents=True, exist_ok=True)
        TOKEN_FILE.write_text(env_token)
        try:
            TOKEN_FILE.chmod(0o600)
        except Exception:
            pass
        return env_token

    # 4. Generate random 256-bit token on first run and persist
    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    generated_token = secrets.token_hex(32)
    TOKEN_FILE.write_text(generated_token)
    try:
        TOKEN_FILE.chmod(0o600)
    except Exception:
        pass
    return generated_token


# Load active token (will raise RuntimeError if default weak token is configured)
DAYPILOT_API_TOKEN = get_or_create_daypilot_token()


def verify_daypilot_token(x_daypilot_token: Optional[str] = Header(None, alias="X-DayPilot-Token")):
    """
    Router-level dependency enforcing token verification on all state-changing endpoints.
    """
    if not x_daypilot_token or not secrets.compare_digest(x_daypilot_token, DAYPILOT_API_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized: invalid or missing X-DayPilot-Token")
