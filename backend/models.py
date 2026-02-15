from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, List, Any
from datetime import datetime

# Request Models
class WoundUploadRequest(BaseModel):
    user_id: Optional[int] = 1
    case_id: Optional[int] = None

class ClassifyRequest(BaseModel):
    wound_id: int
    similar_label: Optional[str] = None

class RecommendRequest(BaseModel):
    classification_id: int
    wound_type: str
    confidence: float
    # Optional patient symptoms
    pain_level: Optional[str] = "none"
    fever: Optional[bool] = False
    discharge_type: Optional[str] = "none"
    redness_spread: Optional[bool] = False

class CompareRequest(BaseModel):
    base_wound_id: int
    current_wound_id: int

class CreateCaseRequest(BaseModel):
    name: str
    description: Optional[str] = None
    user_id: int = 1

class SaveAnalysisRequest(BaseModel):
    wound_id: int
    analysis: Dict[str, Any]

class SaveComparisonRequest(BaseModel):
    case_id: int
    wound_id_before: int
    wound_id_after: int
    analysis: Dict[str, Any]

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LogoutRequest(BaseModel):
    session_token: str

class VerifySessionRequest(BaseModel):
    session_token: str

# Response Models
class WoundUploadResponse(BaseModel):
    success: bool
    wound_id: Optional[int] = None
    image_path: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None

class ClassificationResponse(BaseModel):
    success: bool
    classification_id: Optional[int] = None
    wound_type: Optional[str] = None
    confidence: Optional[float] = None
    probabilities: Optional[Dict[str, float]] = None
    redness_level: Optional[int] = None
    discharge_detected: Optional[bool] = None
    discharge_type: Optional[str] = None
    edge_quality: Optional[int] = None
    tissue_composition: Optional[Dict[str, float]] = None
    wound_location: Optional[str] = None
    processing_time_ms: Optional[int] = None
    error: Optional[str] = None

class RecommendationResponse(BaseModel):
    success: bool
    recommendation_id: Optional[int] = None
    recommendation: Optional[Dict[str, Any]] = None
    risk_level: Optional[str] = None
    severity_score: Optional[float] = None
    tissue_composition: Optional[Dict[str, float]] = None
    error: Optional[str] = None

class HistoryResponse(BaseModel):
    success: bool
    wounds: Optional[List[Dict[str, Any]]] = None
    total: Optional[int] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    error: Optional[str] = None

class CaseResponse(BaseModel):
    success: bool
    case: Optional[Dict[str, Any]] = None
    cases: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None

class ComparisonResponse(BaseModel):
    success: bool
    comparison: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    email_verified: bool
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    blood_type: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    profile_image: Optional[str] = None
    created_at: datetime

class AuthResponse(BaseModel):
    success: bool
    user: Optional[UserResponse] = None
    session_token: Optional[str] = None
    expires_at: Optional[str] = None
    error: Optional[str] = None
