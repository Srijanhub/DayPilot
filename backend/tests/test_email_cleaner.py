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
