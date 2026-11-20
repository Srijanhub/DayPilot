"""
DayPilot GitHub Notifications Sync
Queries GitHub Notifications API via `gh api /notifications` or token.
Fails gracefully with structured data if offline or not logged in.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH)

import subprocess
import json
import urllib.request
from typing import List, Dict, Any


def get_github_notifications() -> List[Dict[str, Any]]:
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        # 1. Try Notifications API
        try:
            req = urllib.request.Request(
                "https://api.github.com/notifications?per_page=10",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "DayPilot-Engine/1.0"
                }
            )
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data:
                    formatted = []
                    for item in data[:5]:
                        subject = item.get("subject", {})
                        repo = item.get("repository", {})
                        raw_url = subject.get("url", "")
                        html_url = raw_url.replace("api.github.com/repos", "github.com").replace("/pulls/", "/pull/")
                        if not html_url or html_url == raw_url:
                            html_url = f"https://github.com/{repo.get('full_name', 'notifications')}"
                        
                        formatted.append({
                            "repo": repo.get("name", "repo"),
                            "pr": f"#{html_url.split('/')[-1]}" if html_url.split('/')[-1].isdigit() else "NOTIF",
                            "title": subject.get("title", "GitHub Notification"),
                            "type": subject.get("type", "Issue"),
                            "status": "UNREAD",
                            "url": html_url,
                            "concern": f"Unread notification in {repo.get('name', 'repository')}."
                        })
                    return formatted
        except Exception:
            pass

        # 2. If notifications requires extra scope or is caught up, fetch user's live open PRs & events
        try:
            # Get authenticated username
            req_user = urllib.request.Request(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "DayPilot-Engine/1.0"
                }
            )
            with urllib.request.urlopen(req_user, timeout=4.0) as resp_u:
                user_data = json.loads(resp_u.read().decode("utf-8"))
                username = user_data.get("login")

            if username:
                # Query active open pull requests
                search_url = f"https://api.github.com/search/issues?q=author:{username}+type:pr+state:open&sort=updated&per_page=5"
                req_prs = urllib.request.Request(
                    search_url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github+json",
                        "User-Agent": "DayPilot-Engine/1.0"
                    }
                )
                with urllib.request.urlopen(req_prs, timeout=4.0) as resp_prs:
                    pr_data = json.loads(resp_prs.read().decode("utf-8"))
                    items = pr_data.get("items", [])
                    if items:
                        live_prs = []
                        for item in items:
                            html_url = item.get("html_url", "")
                            # Extract repo from URL: https://github.com/owner/repo/pull/123
                            parts = html_url.split("/")
                            repo_name = f"{parts[-4]}/{parts[-3]}" if len(parts) >= 5 else "GitHub"
                            pr_num = f"#{parts[-1]}" if len(parts) >= 1 and parts[-1].isdigit() else "PR"

                            live_prs.append({
                                "repo": repo_name,
                                "pr": pr_num,
                                "title": item.get("title", "Active Pull Request"),
                                "author": username,
                                "status": "OPEN PR",
                                "url": html_url,
                                "concern": f"Active pull request awaiting review in {repo_name}."
                            })
                        return live_prs
        except Exception:
            pass

    # 2. Try GitHub CLI (`gh api`)
    try:
        res = subprocess.check_output(
            ["gh", "api", "/notifications"],
            stderr=subprocess.DEVNULL,
            timeout=3.0
        ).decode("utf-8")
        data = json.loads(res)
        formatted = []
        for item in data[:5]:
            subject = item.get("subject", {})
            repo = item.get("repository", {})
            raw_url = subject.get("url", "")
            html_url = raw_url.replace("api.github.com/repos", "github.com").replace("/pulls/", "/pull/")
            if not html_url or html_url == raw_url:
                html_url = f"https://github.com/{repo.get('full_name', 'notifications')}"

            formatted.append({
                "repo": repo.get("name", "repo"),
                "title": subject.get("title", "Notification"),
                "type": subject.get("type", "Issue"),
                "status": "UNREAD",
                "url": html_url,
                "concern": f"Actionable {subject.get('type', 'item')} assigned in {repo.get('name', 'repo')}."
            })
        return formatted
    except Exception:
        pass

    # Clean fallback: Return empty list when offline or unauthenticated (no synthetic mocks)
    return []
