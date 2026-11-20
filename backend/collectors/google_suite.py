"""
DayPilot Google Suite Collector (Gmail & Google Calendar)
Fetches real unread emails via IMAP / App Password and Calendar events via iCal URL.
Falls back to clean structured items if credentials are not configured.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH)

import imaplib
import email
from email.header import decode_header
import urllib.request
import urllib.parse
from datetime import datetime, date
from typing import List, Dict, Any
import re
import html


def clean_email_body(raw_text: str) -> str:
    """Strips all HTML markup, DOCTYPE, head, style, script, comments, entities, and invisible tracking characters."""
    if not raw_text:
        return ""

    # 1. Strip comments including conditional Outlook comments (<!--[if ...]> and malformed <!->, em-dashes)
    text = re.sub(r'<!--[\s\S]*?(-->|$)', ' ', raw_text)
    text = re.sub(r'<!\[[\s\S]*?(\]>|$)', ' ', text)
    text = re.sub(r'<!DOCTYPE[\s\S]*?>', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'<!-{1,2}>', ' ', text)
    text = re.sub(r'<![\u2014\u2013-]*>', ' ', text)
    text = re.sub(r'<![^>]*>', ' ', text)

    # 2. Strip <style>, <script>, <head>, <title> blocks with their contents (even if unclosed or multiline)
    text = re.sub(r'<style[\s\S]*?(</style>|$)', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'<script[\s\S]*?(</script>|$)', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'<head[\s\S]*?(</head>|$)', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'<title[\s\S]*?(</title>|$)', ' ', text, flags=re.IGNORECASE)

    # 3. Strip all remaining HTML tags and dangling opening brackets
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'<[^>]*$', ' ', text)

    # 4. Unescape HTML entities (&nbsp;, &amp;, &#39;, etc.)
    text = html.unescape(text)

    # 5. Remove email image references and markdown image artifacts
    text = re.sub(r'\[image:[^\]]*\]', '', text)
    text = re.sub(r'https?://\S+', '', text)

    # 6. Remove zero-width characters, invisible preheader spacers, and soft hyphens
    text = re.sub(r'[\ufeff\u034f\u200b\u200c\u200d\u2060\u00a0\xad]+', ' ', text)

    # 7. Remove corporate address and legal boilerplate footers
    text = re.sub(
        r'(View in browser|Unsubscribe|Terms and conditions|Privacy Policy|Manage preferences|Preferences|You\'re receiving this email because|Thank you for choosing Zoom|Zoom Communications, Inc).*$',
        '',
        text,
        flags=re.IGNORECASE
    )

    # 8. Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


DISCLAIMER_KEYWORDS = [
    'unsubscribe', 'not interested', 'opt out', 'pvt ltd', 'pvt. ltd', 'inc.', 'llc',
    'tech park', 'sohna road', 'almaden blvd', 'all rights reserved', 'terms and conditions',
    'privacy policy', 'view in browser', 'manage preferences', 'zoom communications',
    'thank you for choosing zoom', 'iris tech park', 'sector -', 'support@', 'noreply@',
    'copyright', '©'
]


def extract_email_summary(subject: str, sender: str, body_text: str) -> str:
    """Generate a clean executive summary of the email content."""
    clean = clean_email_body(body_text)

    lower_sub = subject.lower()
    lower_body = clean.lower()

    if "app password created" in lower_body or "app password created" in lower_sub:
        return "Google confirmed that an App Password was created for DayPilot. No action required if you authorized it."
    if "shared some google account data" in lower_sub or "account data with" in lower_sub:
        domain = lower_sub.split("with")[-1].strip() if "with" in lower_sub else "an external app"
        return f"Google Security Notice: You connected your Google account with {domain}. Review your authorized apps if unexpected."
    if "new sign-in" in lower_body or "security alert" in lower_sub:
        if "mac os" in lower_body or "macos" in lower_body:
            return "Google detected a new sign-in on a macOS device. If this was you, no action is needed."
        return "Google Security Alert regarding recent sign-in activity on your Google Account."
    if "review your google account settings" in lower_sub:
        return "Google recommendation to review and adjust your privacy, backup, and security settings on this device."
    if "linkedin" in sender.lower() or "job alert" in lower_sub:
        return f"Career Alert: New matching role found — {subject}."
    if "zoom" in sender.lower() and "meeting assets" in lower_sub:
        return f"Zoom Recording & Assets ready: {subject.replace('Meeting assets for ', '').replace(' are ready!', '')}."

    # Protect abbreviations from splitting
    protected_text = clean
    for abbrev in ['Pvt.', 'Ltd.', 'Inc.', 'Corp.', 'Mr.', 'Ms.', 'Dr.', 'U.S.', 'e.g.', 'i.e.']:
        protected_text = protected_text.replace(abbrev, abbrev.replace('.', '@DOT@'))

    # Look for meaningful sentences that are not boilerplate
    raw_sentences = re.split(r'[.!?]+(?:\s+|$)|[\n\r]+', protected_text)
    meaningful = []
    for s in raw_sentences:
        s = s.replace('@DOT@', '.').strip()
        if len(s) < 15:
            continue
        s_low = s.lower()
        if any(dk in s_low for dk in DISCLAIMER_KEYWORDS):
            continue
        if s.startswith(('hi ', 'hello', 'dear ', 'thanks', 'click here', '<!', '<', '{', '[', 'http')):
            continue
        if any(s_low.startswith(p) for p in ['view in', 'unsubscribe', 'terms', 'privacy']):
            continue
        meaningful.append(s)

    if meaningful:
        summary = " ".join(meaningful[:2])
        return summary[:280] + ("..." if len(summary) > 280 else "")

    return f"Email regarding: {subject}"


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

    # Clean fallback: Return empty list when offline or without active calendar (no synthetic mocks)
    return []


def get_priority_emails() -> List[Dict[str, Any]]:
    gmail_addr = os.environ.get("GMAIL_ADDRESS")
    gmail_pwd = os.environ.get("GMAIL_APP_PASSWORD")

    if gmail_addr and gmail_pwd:
        try:
            clean_pwd = gmail_pwd.replace(" ", "").strip()
            mail = imaplib.IMAP4_SSL("imap.gmail.com", timeout=10)
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
                    _, msg_data = mail.fetch(eid, "(BODY.PEEK[])")
                    if not msg_data or not msg_data[0]:
                        continue
                    msg = email.message_from_bytes(msg_data[0][1])
                    
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

                    # Extract body content
                    body_text = ""
                    html_text = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            ctype = part.get_content_type()
                            cdisp = str(part.get("Content-Disposition", ""))
                            if "attachment" in cdisp:
                                continue
                            payload = part.get_payload(decode=True)
                            if not payload:
                                continue
                            charset = part.get_content_charset() or "utf-8"
                            decoded = payload.decode(charset, errors="ignore")
                            if ctype == "text/plain" and not body_text:
                                body_text = decoded
                            elif ctype == "text/html" and not html_text:
                                html_text = decoded
                    else:
                        payload = msg.get_payload(decode=True)
                        if payload:
                            charset = msg.get_content_charset() or "utf-8"
                            decoded = payload.decode(charset, errors="ignore")
                            if msg.get_content_type() == "text/html":
                                html_text = decoded
                            else:
                                body_text = decoded

                    raw_content = body_text if body_text else html_text
                    clean_sender = sender.split("<")[0].strip().replace('"', '') or sender
                    summary = extract_email_summary(subject, clean_sender, raw_content)
                    is_urgent = any(kw in (subject + summary).lower() for kw in ["urgent", "important", "deadline", "action", "review", "due", "security alert"])
                    
                    results.append({
                        "id": f"live_{eid.decode()}",
                        "from": clean_sender,
                        "subject": subject,
                        "summary": summary,
                        "time": date_str[:16] if date_str else "Today",
                        "priority": "HIGH" if is_urgent else "NORMAL",
                        "concern": summary,
                        "url": f"https://mail.google.com/mail/u/0/#search/{urllib.parse.quote(clean_sender)}"
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

    # Clean fallback: Return empty list when offline or unauthenticated (no synthetic mocks)
    return []
