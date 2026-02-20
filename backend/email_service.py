import smtplib
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import config

def generate_otp() -> str:
    """Generate a 6-digit OTP"""
    return str(random.randint(100000, 999999))

def send_otp_email(to_email: str, otp_code: str, user_name: str = "User") -> bool:
    """
    Send OTP verification email
    
    Args:
        to_email: Recipient email address
        otp_code: 6-digit OTP code
        user_name: Name of the user
        
    Returns:
        True if email sent successfully, False otherwise
    """
    
    # Check if SMTP is configured
    if not config.SMTP_USERNAME or not config.SMTP_PASSWORD:
        print("⚠️  SMTP credentials not configured. OTP will be printed to console.")
        print(f"📧 OTP for {to_email}: {otp_code}")
        return True  # Return True for development purposes
    
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = f"Your Verification Code: {otp_code}"
        message["From"] = f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        
        # Create HTML body
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }}
                .content {{
                    background: #f9f9f9;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }}
                .otp-box {{
                    background: white;
                    border: 2px dashed #667eea;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 20px 0;
                }}
                .otp-code {{
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 8px;
                    color: #667eea;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 20px;
                    color: #666;
                    font-size: 12px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✉️ Email Verification</h1>
                </div>
                <div class="content">
                    <p>Hello {user_name},</p>
                    <p>Thank you for signing up for Surgical Wound Care! To complete your registration, please verify your email address using the code below:</p>
                    
                    <div class="otp-box">
                        <div class="otp-code">{otp_code}</div>
                    </div>
                    
                    <p>This code will expire in <strong>{config.OTP_EXPIRY_MINUTES} minutes</strong>.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                    
                    <p>Best regards,<br>The Surgical Wound Care Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated email. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Create plain text version
        text_body = f"""
        Email Verification - Surgical Wound Care
        
        Hello {user_name},
        
        Thank you for signing up! Please use this code to verify your email:
        
        {otp_code}
        
        This code will expire in {config.OTP_EXPIRY_MINUTES} minutes.
        
        If you didn't request this code, please ignore this email.
        
        Best regards,
        The Surgical Wound Care Team
        """
        
        # Attach both versions
        part1 = MIMEText(text_body, "plain")
        part2 = MIMEText(html_body, "html")
        message.attach(part1)
        message.attach(part2)
        
        # Send email
        # Gmail App Passwords contain spaces for readability — strip them before auth
        smtp_password = config.SMTP_PASSWORD.replace(' ', '') if config.SMTP_PASSWORD else ''
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(config.SMTP_USERNAME, smtp_password)
            server.send_message(message)
        
        print(f"✅ OTP email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send OTP email: {str(e)}")
        # For development, print OTP to console as fallback
        print(f"📧 OTP for {to_email}: {otp_code}")
        return False


def send_password_reset_email(to_email: str, otp_code: str, user_name: str = "User") -> bool:
    """
    Send a password-reset OTP email.
    Returns True if sent successfully, False otherwise.
    """

    if not config.SMTP_USERNAME or not config.SMTP_PASSWORD:
        print(f"📧 [DEV] Reset OTP for {to_email}: {otp_code}")
        return True

    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = f"Password Reset Code: {otp_code}"
        message["From"] = f"Surgical Wound Care <{config.SMTP_FROM_EMAIL or config.SMTP_USERNAME}>"
        message["To"] = to_email

        html_body = f"""
        <html><body style="font-family:sans-serif;background:#f4f4f4;margin:0;padding:20px;">
        <div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
            <div style="background:#2F80ED;padding:28px 24px;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:22px;">Password Reset</h1>
            </div>
            <div style="padding:28px 24px;">
                <p>Hi <strong>{user_name}</strong>,</p>
                <p>Use the code below to reset your password. It expires in <strong>{config.OTP_EXPIRY_MINUTES} minutes</strong>.</p>
                <div style="text-align:center;letter-spacing:8px;font-size:36px;font-weight:700;color:#2F80ED;
                            padding:20px;background:#EBF4FF;border-radius:8px;margin:20px 0;">
                    {otp_code}
                </div>
                <p style="color:#888;font-size:13px;">If you did not request a password reset, ignore this email — your password will not change.</p>
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

        message.attach(MIMEText(text_body, "plain"))
        message.attach(MIMEText(html_body, "html"))

        smtp_password = config.SMTP_PASSWORD.replace(' ', '') if config.SMTP_PASSWORD else ''
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(config.SMTP_USERNAME, smtp_password)
            server.send_message(message)

        print(f"✅ Password reset email sent to {to_email}")
        return True

    except Exception as e:
        print(f"❌ Failed to send reset email to {to_email}: {e}")
        print(f"📧 [DEV] Reset OTP for {to_email}: {otp_code}")
        return False

