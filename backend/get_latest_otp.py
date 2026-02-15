import sqlite3
import os

DB_PATH = "wound_care.db"

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT otp_code, email FROM email_verification_otps ORDER BY created_at DESC LIMIT 1")
    row = cursor.fetchone()
    if row:
        print(f"LATEST OTP: {row[0]}")
        print(f"FOR EMAIL:  {row[1]}")
    else:
        print("NO OTP FOUND")
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
