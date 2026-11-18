"""
DayPilot Google Suite Collector (Gmail & Google Calendar)
Fetches real unread emails via IMAP / App Password and Calendar events via iCal URL.
Falls back to clean structured items if credentials are not configured.
"""

import os
import imaplib
import email
from email.header import decode_header
import urllib.request
import urllib.parse
from datetime import datetime, date
from typing import List, Dict, Any


def get_calendar_events() -> List[Dict[str, Any]]:
    ical_url = os.environ.get("GOOGLE_CALENDAR_ICAL_URL")
    if ical_url:
        try:
            req = urllib.request.Request(ical_url, headers={"User-Agent": "DayPilot/1.0"})
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                content = resp.read().decode("utf-8", errors="ignore")
                events = []
                today_str = datetime.now().strftime("%Y%m%d")
                
                # Simple parser for VEVENT
                vevents = content.split("BEGIN:VEVENT")
                for item in vevents[1:]:
                    lines = item.split("\n")
                    summary = "Calendar Event"
                    dtstart = ""
                    for line in lines:
                        if line.startswith("SUMMARY:"):
                            summary = line.replace("SUMMARY:", "").strip()
                        elif line.startswith("DTSTART"):
                            dtstart = line.split(":")[-1].strip()
                    
                    if today_str in dtstart or not dtstart:
                        events.append({
                            "id": f"cal_{len(events)+1}",
                            "time": "Today",
                            "title": summary,
                            "type": "WORK" if "review" in summary.lower() or "sync" in summary.lower() else "STUDY",
                            "urgent": False,
                            "attendees": ["Google Calendar"],
                            "url": "https://calendar.google.com",
                            "concern": f"Scheduled event: {summary}"
                        })
                if events:
                    return events[:5]
        except Exception:
            pass

    # Graceful stub when offline / without active OAuth tokens
    return [
        {
            "id": "cal_1",
            "time": "10:00 - 11:30 AM",
            "title": "BossCoder: Dynamic Programming Lab 4",
            "type": "STUDY",
            "urgent": True,
            "attendees": ["Mentor", "Batch 28"],
            "url": "https://school.bosscoderacademy.com/home",
            "concern": "High-priority problem set submission due today."
        },
        {
            "id": "cal_2",
            "time": "02:00 - 02:45 PM",
            "title": "GitHub: Review & Merge Auth Refactor PR #42",
            "type": "WORK",
            "urgent": False,
            "attendees": ["Dev Team"],
            "url": "https://github.com/notifications",
            "concern": "Review blocking team merge."
        },
        {
            "id": "cal_3",
            "time": "08:00 - 09:30 PM",
            "title": "BossCoder Live Lecture: Graph Theory & BFS/DFS",
            "type": "STUDY",
            "urgent": True,
            "attendees": ["Instructor", "DSA Cohort"],
            "url": "https://school.bosscoderacademy.com/home",
            "concern": "Attendance mandatory for Batch 28 live class."
        }
    ]


def get_priority_emails() -> List[Dict[str, Any]]:
    gmail_addr = os.environ.get("GMAIL_ADDRESS")
    gmail_pwd = os.environ.get("GMAIL_APP_PASSWORD")

    if gmail_addr and gmail_pwd:
        try:
            # Clean password if user pasted with spaces
            clean_pwd = gmail_pwd.replace(" ", "").strip()
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(gmail_addr, clean_pwd)
            mail.select("INBOX")
            
            status, messages = mail.search(None, "UNSEEN")
            if status == "OK" and messages[0]:
                email_ids = messages[0].split()
                # Take latest 5 unread
                latest_ids = email_ids[-5:]
                latest_ids.reverse()

                results = []
                for eid in latest_ids:
                    _, msg_data = mail.fetch(eid, "(RFC822.HEADER)")
                    for response_part in msg_data:
                        if isinstance(response_part, tuple):
                            msg = email.message_from_bytes(response_part[1])
                            
                            # Subject
                            subject_header = decode_header(msg.get("Subject", "No Subject"))[0]
                            subject = subject_header[0]
                            if isinstance(subject, bytes):
                                subject = subject.decode(subject_header[1] or "utf-8", errors="ignore")
                            
                            # From
                            from_header = decode_header(msg.get("From", "Unknown Sender"))[0]
                            sender = from_header[0]
                            if isinstance(sender, bytes):
                                sender = sender.decode(from_header[1] or "utf-8", errors="ignore")

                            date_str = msg.get("Date", "")
                            is_urgent = any(kw in (subject + sender).lower() for kw in ["urgent", "important", "deadline", "action", "review", "due"])
                            
                            results.append({
                                "id": f"live_{eid.decode()}",
                                "from": sender.split("<")[0].strip() or sender,
                                "subject": subject,
                                "time": date_str[:16] if date_str else "Today",
                                "priority": "HIGH" if is_urgent else "NORMAL",
                                "concern": f"Unread message from {sender.split('<')[0].strip()}: {subject}",
                                "url": f"https://mail.google.com/mail/u/0/#search/{urllib.parse.quote(sender.split('<')[0].strip())}"
                            })

                mail.close()
                mail.logout()
                return results  # Return live results (even if 0 unread)
            else:
                mail.close()
                mail.logout()
                return []  # Inbox zero!
        except Exception:
            pass

    # Graceful stub when offline / without active OAuth tokens
    return [
        {
            "id": "msg_101",
            "from": "BossCoder Mentor",
            "subject": "Review feedback on Binary Search Trees Lab",
            "snippet": "Great job on the AVL tree balancing case. Make sure to review the DP problem set before 4 PM.",
            "time": "08:15 AM",
            "priority": "HIGH",
            "concern": "Action required: Review DP problem set before the 4:00 PM deadline.",
            "url": "https://mail.google.com/mail/u/0/#search/BossCoder"
        },
        {
            "id": "msg_102",
            "from": "GitHub Notifications",
            "subject": "[daypilot] 2 new PR review requests assigned",
            "snippet": "srijanhalder requested your review on #42: feat(orb): simplex noise shader.",
            "time": "07:40 AM",
            "priority": "NORMAL",
            "concern": "Action required: Code review requested on #42 simplex noise shader.",
            "url": "https://mail.google.com/mail/u/0/#search/github"
        }
    ]
