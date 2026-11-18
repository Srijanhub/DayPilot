from collectors.google_suite import clean_email_body, extract_email_summary


def test_strips_html_doctype_head_and_styles():
    raw_html = """<!DOCTYPE html> <html dir="ltr"> <head> <meta charset="utf-8"> <meta http-equiv="x-ua-compatible" content="ie=edge"> <title></title> <meta name="viewport" content="width=device-width, initial-scale=1"> <meta name="color-scheme" content="light dark only"> <style>body { background: #000; }</style> </head> <body> <p>Less to-do. More ta-da. ChatGPT can now help you write and code faster.</p> </body> </html>"""
    cleaned = clean_email_body(raw_html)
    assert "<!DOCTYPE" not in cleaned
    assert "<html" not in cleaned
    assert "<head" not in cleaned
    assert "<style" not in cleaned
    assert "background:" not in cleaned
    assert "ChatGPT can now help you write and code faster" in cleaned

    summary = extract_email_summary("Less to-do. More ta-da.", "ChatGPT", raw_html)
    assert "<" not in summary
    assert ">" not in summary
    assert "ChatGPT can now help you write and code faster" in summary


def test_strips_mso_and_conditional_comments():
    raw_google = """Keep track of your Google Account data onlinesrijanhalder@gmail.com <!--[if !mso]><!-> <!--[if false]><!-> You're receiving this email because you used Sign in with Google to sign in to dcocafc5gdoi5.cloudfront.net on 18 November at 12:36. This email summarises the info that you shared."""
    cleaned = clean_email_body(raw_google)
    assert "<!--" not in cleaned
    assert "-->" not in cleaned
    assert "[if !mso]" not in cleaned
    assert "<!-" not in cleaned
    assert "You're receiving this email because" in raw_google

    summary = extract_email_summary(
        "You shared some Google Account data with dcocafc5gdoi5.cloudfront.net",
        "Google",
        raw_google
    )
    assert "<!--" not in summary
    assert "[if !mso]" not in summary
    assert "Google Security Notice: You connected your Google account with dcocafc5gdoi5.cloudfront.net." in summary


def test_strips_truncated_tags_and_em_dash_comments():
    truncated_html = """<!DOCTYPE html> <html dir="ltr"> <head> <meta charset="utf-8"> <meta http-equiv="x-ua-compatible" content="ie=edge"> <title></title> <meta name="viewport" content="width=device-width, initial-scale=1"> <meta name="color-scheme" content="light dark only"> <meta name="supported-col..."""
    cleaned = clean_email_body(truncated_html)
    assert "<meta" not in cleaned
    assert "<!DOCTYPE" not in cleaned
    summary = extract_email_summary("Less to-do. More ta-da.", "ChatGPT", truncated_html)
    assert "<" not in summary
    assert "Email regarding: Less to-do. More ta-da." == summary

    em_dash_comment = """Keep track of your Google Account data onlinesrijanhalder@gmail.com <!--[if !mso]> <!--> <!--[if false]><!—> You're receiving this email because you used Sign in with Google to sign in to < on 18 November at 12:36. This email summarises the info that you shared."""
    cleaned_dash = clean_email_body(em_dash_comment)
    assert "<!--" not in cleaned_dash
    assert "<!—" not in cleaned_dash
    assert "[if !mso]" not in cleaned_dash
    assert "[if false]" not in cleaned_dash


def test_strips_zero_width_spaces_and_zoom_boilerplate():
    unstop_raw = "Your profile is a match! \ufeff \u034f \ufeff \u034f \ufeff \u034f \ufeff \u034f Earn INR 25,000 per month by joining our winter mentorship program."
    cleaned_unstop = clean_email_body(unstop_raw)
    assert "\ufeff" not in cleaned_unstop
    assert "\u034f" not in cleaned_unstop
    assert "Your profile is a match! Earn INR 25,000 per month by joining our winter mentorship program." == cleaned_unstop

    zoom_raw = "Meeting assets for Srijan Halder's Zoom Meeting are ready! Assets shared in meeting Srijan Halder's Zoom Meeting 11/18/2026, 6:05:06 PM Thank you for choosing Zoom, The Zoom Team Zoom.com 55 Almaden Blvd San Jose, CA 95113 +1.888.799.9666 © 2026 Zoom Communications, Inc."
    cleaned_zoom = clean_email_body(zoom_raw)
    assert "Thank you for choosing Zoom" not in cleaned_zoom
    assert "Almaden Blvd" not in cleaned_zoom
    assert "Meeting assets for Srijan Halder's Zoom Meeting are ready!" in cleaned_zoom

    zoom_summary = extract_email_summary("Meeting assets for Srijan Halder's Zoom Meeting are ready!", "Zoom", zoom_raw)
    assert "Zoom Recording & Assets ready" in zoom_summary
    assert "Almaden Blvd" not in zoom_summary
