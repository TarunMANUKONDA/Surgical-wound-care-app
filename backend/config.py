import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Gemini API
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    
    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./wound_care.db")
    
    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8000))
    
    # File Upload
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 10485760))  # 10MB
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
    
    # Email/SMTP Configuration
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Surgical Wound Care")
    OTP_EXPIRY_MINUTES = 10  # OTP validity duration
    
    # CORS
    CORS_ORIGINS = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
        "http://10.0.2.2:5173",   # Android emulator
        "capacitor://localhost",  # Capacitor
        "http://localhost",
        "http://192.168.0.6:5173", # Local IP Frontend
        "http://192.168.0.6:8000", # Local IP Backend (Docs)
    ]
    
    # Add origins from environment variable
    additional_origins = os.getenv("ADDITIONAL_CORS_ORIGINS")
    if additional_origins:
        CORS_ORIGINS.extend([origin.strip() for origin in additional_origins.split(",")])

config = Config()
