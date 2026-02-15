import smtplib
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv
import socket

# Load environment variables
load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
# Remove spaces if present, just in case
if SMTP_PASSWORD:
    SMTP_PASSWORD = SMTP_PASSWORD.replace(" ", "")

SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL")

print(f"Testing SMTP Configuration:")
print(f"Host: {SMTP_HOST}")
print(f"Port: {SMTP_PORT}")
print(f"User: {SMTP_USERNAME}")
print(f"From: {SMTP_FROM_EMAIL}")
print("-" * 30)

try:
    print("Connecting to SMTP server (with 10s timeout)...")
    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
    server.set_debuglevel(1)
    
    print("EHLO...")
    server.ehlo()
    
    print("Starting TLS...")
    server.starttls()
    
    print("EHLO (again)...")
    server.ehlo()
    
    print("Logging in...")
    try:
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        print("✅ Login successful!")
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ Login failed: {e}")
        server.quit()
        exit(1)
    
    print("Sending test email...")
    msg = MIMEText("This is a test email from the Surgical Wound Care app debugger.")
    msg["Subject"] = "Test Email - Surgical Wound Care"
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = SMTP_USERNAME
    
    server.send_message(msg)
    print("✅ Email sent successfully!")
    
    server.quit()
    
except socket.timeout:
    print("\n❌ Connection timed out. Check your internet connection or firewall.")
except Exception as e:
    print(f"\n❌ FAILED: {str(e)}")
