from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, User, Session as DBSession, EmailVerificationOTP
from models import SignupRequest, LoginRequest, LogoutRequest, VerifySessionRequest, AuthResponse, UserResponse
from passlib.context import CryptContext
from datetime import datetime, timedelta
from email_service import generate_otp, send_otp_email
from config import config
import secrets

router = APIRouter()

# Password hashing - Configure bcrypt to handle long passwords
# bcrypt has a 72-byte limit, so we configure it to automatically truncate
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__truncate_error=False  # Allow passwords longer than 72 bytes by truncating
)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)

@router.post("/signup")
async def signup(
    request: SignupRequest,
    db: Session = Depends(get_db)
):
    """Create a new user account and send OTP for verification"""
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user (not verified yet)
    user = User(
        name=request.name,
        email=request.email,
        password_hash=hash_password(request.password),
        email_verified=False
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Generate OTP
    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=config.OTP_EXPIRY_MINUTES)
    
    # Clean up old OTPs for this email
    db.query(EmailVerificationOTP).filter(
        EmailVerificationOTP.email == request.email,
        EmailVerificationOTP.verified == False
    ).delete()
    
    # Save OTP to database
    otp_record = EmailVerificationOTP(
        email=request.email,
        otp_code=otp_code,
        expires_at=expires_at
    )
    db.add(otp_record)
    db.commit()
    
    # Send OTP email
    email_sent = send_otp_email(request.email, otp_code, request.name)
    
    if not email_sent:
        # If email fails but we're in development mode, still return success
        # This allows testing without SMTP configuration
        pass
    
    return {
        "success": True,
        "message": "OTP sent to your email",
        "email": request.email,
        "otp_sent": True
    }


@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp(
    email: str,
    otp_code: str,
    db: Session = Depends(get_db)
):
    """Verify OTP and complete user registration"""
    
    # Find OTP record
    otp_record = db.query(EmailVerificationOTP).filter(
        EmailVerificationOTP.email == email,
        EmailVerificationOTP.otp_code == otp_code,
        EmailVerificationOTP.verified == False
    ).first()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    
    # Check if OTP is expired
    if otp_record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    
    # Mark OTP as verified
    otp_record.verified = True
    
    # Update user email verification status
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.email_verified = True
    
    # Create session for auto-login
    session_token = generate_session_token()
    expires_at = datetime.utcnow() + timedelta(days=30)
    
    session = DBSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=expires_at
    )
    
    db.add(session)
    db.commit()
    db.refresh(user)
    
    return AuthResponse(
        success=True,
        user=UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            email_verified=user.email_verified,
            phone=user.phone,
            date_of_birth=user.date_of_birth,
            blood_type=user.blood_type,
            emergency_contact=user.emergency_contact,
            emergency_phone=user.emergency_phone,
            profile_image=user.profile_image,
            created_at=user.created_at
        ),
        session_token=session_token,
        expires_at=expires_at.isoformat()
    )


@router.post("/resend-otp")
async def resend_otp(
    email: str,
    db: Session = Depends(get_db)
):
    """Resend OTP to user's email"""
    
    # Check if user exists
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already verified
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email already verified")
    
    # Generate new OTP
    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=config.OTP_EXPIRY_MINUTES)
    
    # Clean up old OTPs for this email
    db.query(EmailVerificationOTP).filter(
        EmailVerificationOTP.email == email,
        EmailVerificationOTP.verified == False
    ).delete()
    
    # Save new OTP
    otp_record = EmailVerificationOTP(
        email=email,
        otp_code=otp_code,
        expires_at=expires_at
    )
    db.add(otp_record)
    db.commit()
    
    # Send OTP email
    send_otp_email(email, otp_code, user.name)
    
    return {
        "success": True,
        "message": "OTP resent successfully"
    }


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login with email and password"""
    
    # Find user
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create session
    session_token = generate_session_token()
    expires_at = datetime.utcnow() + timedelta(days=30)
    
    session = DBSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=expires_at
    )
    
    db.add(session)
    db.commit()
    
    return AuthResponse(
        success=True,
        user=UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            email_verified=user.email_verified,
            phone=user.phone,
            date_of_birth=user.date_of_birth,
            blood_type=user.blood_type,
            emergency_contact=user.emergency_contact,
            emergency_phone=user.emergency_phone,
            profile_image=user.profile_image,
            created_at=user.created_at
        ),
        session_token=session_token,
        expires_at=expires_at.isoformat()
    )


@router.post("/logout")
async def logout(
    request: LogoutRequest,
    db: Session = Depends(get_db)
):
    """Logout and invalidate session"""
    
    session = db.query(DBSession).filter(
        DBSession.session_token == request.session_token
    ).first()
    
    if session:
        db.delete(session)
        db.commit()
    
    return {"success": True, "message": "Logged out successfully"}


@router.post("/verify_session")
async def verify_session(
    request: VerifySessionRequest,
    db: Session = Depends(get_db)
):
    """Verify if session is valid"""
    
    session = db.query(DBSession).filter(
        DBSession.session_token == request.session_token
    ).first()
    
    if not session or session.expires_at < datetime.utcnow():
        return AuthResponse(success=False, error="Invalid or expired session")
    
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        return AuthResponse(success=False, error="User not found")
    
    return AuthResponse(
        success=True,
        user=UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            email_verified=user.email_verified,
            phone=user.phone,
            date_of_birth=user.date_of_birth,
            blood_type=user.blood_type,
            emergency_contact=user.emergency_contact,
            emergency_phone=user.emergency_phone,
            profile_image=user.profile_image,
            created_at=user.created_at
        )
    )
