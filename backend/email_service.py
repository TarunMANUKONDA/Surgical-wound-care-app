import random
import json
import urllib.request
import urllib.error
from config import config


def generate_otp() -> str:
    """Generate a 6-digit OTP"""
    return str(random.randint(100000, 999999))


def _send_via_resend(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """
    Send an email via Resend HTTP API.
    Works on Render free tier (no SMTP port restrictions).
    """
    api_key = getattr(config, 'RESEND_API_KEY', None)
    if not api_key:
        return False

    from_addr = getattr(config, 'SMTP_FROM_EMAIL', None) or getattr(config, 'SMTP_USERNAME', None)
    # Resend requires a verified domain for custom from addresses.
    # Use their shared sandbox domain for testing, or your verified domain.
    resend_from = getattr(config, 'RESEND_FROM_EMAIL', None) or f"Surgical Wound Care <onboarding@resend.dev>"

    payload = json.dumps({
        "from": resend_from,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
        "text": text_body,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            result = json.loads(resp.read().decode())
            print(f"✅ Resend email sent → id={result.get('id')}")
            return True
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"❌ Resend API error {e.code}: {body}")
        return False
    except Exception as e:
        print(f"❌ Resend request failed: {e}")
        return False


def send_otp_email(to_email: str, otp_code: str, user_name: str = "User") -> bool:
    """
    Send OTP verification email.
    Uses Resend API (RESEND_API_KEY) if configured, otherwise prints to console (dev mode).
    """
    subject = f"Your Verification Code: {otp_code}"

    html_body = f"""
    <html><body style="font-family:sans-serif;background:#f4f4f4;margin:0;padding:20px;">
    <div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;
                overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
        <div style="background:#2F80ED;padding:28px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">Email Verification</h1>
        </div>
        <div style="padding:28px 24px;">
            <p>Hi <strong>{user_name}</strong>,</p>
            <p>Thank you for signing up! Use the code below to verify your email.
               It expires in <strong>{config.OTP_EXPIRY_MINUTES} minutes</strong>.</p>
            <div style="text-align:center;letter-spacing:8px;font-size:36px;font-weight:700;
                        color:#2F80ED;padding:20px;background:#EBF4FF;
                        border-radius:8px;margin:20px 0;">
                {otp_code}
            </div>
            <p style="color:#888;font-size:13px;">
                If you didn't request this, you can safely ignore this email.
            </p>
            <p>Best regards,<br>The Surgical Wound Care Team</p>
        </div>
    </div>
    </body></html>
    """

    text_body = f"""Email Verification - Surgical Wound Care

Hi {user_name},

Your verification code is: {otp_code}

This code expires in {config.OTP_EXPIRY_MINUTES} minutes.

If you didn't request this, please ignore this email.

— Surgical Wound Care Team
"""

    api_key = getattr(config, 'RESEND_API_KEY', None)
    if not api_key:
        print("⚠️  RESEND_API_KEY not configured — printing OTP to console (dev mode).")
        print(f"📧 OTP for {to_email}: {otp_code}")
        return True  # Allow dev flow to continue

    sent = _send_via_resend(to_email, subject, html_body, text_body)
    if not sent:
        print(f"📧 [DEV fallback] OTP for {to_email}: {otp_code}")
    return sent


def send_password_reset_email(to_email: str, otp_code: str, user_name: str = "User") -> bool:
    """
    Send a password-reset OTP email via Resend HTTP API.
    """
    subject = f"Password Reset Code: {otp_code}"

    html_body = f"""
    <html><body style="font-family:sans-serif;background:#f4f4f4;margin:0;padding:20px;">
    <div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;
                overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
        <div style="background:#2F80ED;padding:28px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">Password Reset</h1>
        </div>
        <div style="padding:28px 24px;">
            <p>Hi <strong>{user_name}</strong>,</p>
            <p>Use the code below to reset your password.
               It expires in <strong>{config.OTP_EXPIRY_MINUTES} minutes</strong>.</p>
            <div style="text-align:center;letter-spacing:8px;font-size:36px;font-weight:700;
                        color:#2F80ED;padding:20px;background:#EBF4FF;
                        border-radius:8px;margin:20px 0;">
                {otp_code}
            </div>
            <p style="color:#888;font-size:13px;">
                If you did not request a password reset, ignore this email — your password will not change.
            </p>
            <p>Best regards,<br>The Surgical Wound Care Team</p>
        </div>
    </div>
    </body></html>
    """

    text_body = f"""Password Reset - Surgical Wound Care

Hi {user_name},

Your password reset code is: {otp_code}

This code expires in {config.OTP_EXPIRY_MINUTES} minutes.

If you did not request this, please ignore this email.

— Surgical Wound Care Team
"""

    api_key = getattr(config, 'RESEND_API_KEY', None)
    if not api_key:
        print(f"📧 [DEV] Reset OTP for {to_email}: {otp_code}")
        return True

    sent = _send_via_resend(to_email, subject, html_body, text_body)
    if not sent:
        print(f"📧 [DEV fallback] Reset OTP for {to_email}: {otp_code}")
    return sent
