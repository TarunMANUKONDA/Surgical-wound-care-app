from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from config import config

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    password_hash = Column(String(255))
    phone = Column(String(20))
    date_of_birth = Column(String(50))
    blood_type = Column(String(10))
    emergency_contact = Column(String(100))
    emergency_phone = Column(String(20))
    profile_image = Column(String(255))
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    wounds = relationship("Wound", back_populates="user")
    cases = relationship("Case", back_populates="user")
    sessions = relationship("Session", back_populates="user")


class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_token = Column(String(255), unique=True, index=True)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="sessions")


class EmailVerificationOTP(Base):
    __tablename__ = "email_verification_otps"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), index=True, nullable=False)
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Case(Base):
    __tablename__ = "cases"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(255))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="cases")
    wounds = relationship("Wound", back_populates="case")


class Wound(Base):
    __tablename__ = "wounds"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    image_path = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    upload_date = Column(DateTime, default=datetime.utcnow, index=True)
    status = Column(String(50), default="pending")
    notes = Column(Text)
    
    # Cached analysis results
    classification = Column(String(100))
    confidence = Column(Float)
    redness_level = Column(Integer)
    discharge_detected = Column(Boolean)
    discharge_type = Column(String(50))
    edge_quality = Column(Integer)
    tissue_composition = Column(JSON)
    analysis = Column(JSON)  # Full analysis JSON
    
    user = relationship("User", back_populates="wounds")
    case = relationship("Case", back_populates="wounds")
    classifications = relationship("Classification", back_populates="wound")


class Classification(Base):
    __tablename__ = "classifications"
    
    id = Column(Integer, primary_key=True, index=True)
    wound_id = Column(Integer, ForeignKey("wounds.id"), index=True)
    wound_type = Column(String(100), nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    all_probabilities = Column(JSON, nullable=False)
    processing_time_ms = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    wound = relationship("Wound", back_populates="classifications")
    recommendations = relationship("Recommendation", back_populates="classification")


class Recommendation(Base):
    __tablename__ = "recommendations"
    
    id = Column(Integer, primary_key=True, index=True)
    classification_id = Column(Integer, ForeignKey("classifications.id"), index=True)
    summary = Column(Text, nullable=False)
    cleaning_instructions = Column(JSON)
    dressing_recommendations = Column(JSON)
    medication_suggestions = Column(JSON)
    expected_healing_time = Column(String(100))
    follow_up_schedule = Column(JSON)
    warning_signs = Column(JSON)
    when_to_seek_help = Column(JSON)
    diet_advice = Column(JSON)
    activity_restrictions = Column(JSON)
    ai_confidence = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    classification = relationship("Classification", back_populates="recommendations")


class Comparison(Base):
    __tablename__ = "comparisons"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    wound_id_before = Column(Integer, ForeignKey("wounds.id"))
    wound_id_after = Column(Integer, ForeignKey("wounds.id"))
    analysis = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


# Database setup
engine = create_engine(config.DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in config.DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully!")
