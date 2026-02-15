from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Wound
from models import WoundUploadResponse
from config import config
import os
import time
from pathlib import Path
import mimetypes

router = APIRouter()

# Ensure upload directory exists
os.makedirs(config.UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=WoundUploadResponse)
async def upload_image(
    image: UploadFile = File(...),
    user_id: int = Form(1),
    case_id: int = Form(None),
    db: Session = Depends(get_db)
):
    """Upload wound image and save to database"""
    
    # Validate file type
    file_extension = Path(image.filename).suffix.lower()
    if file_extension not in config.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Only {', '.join(config.ALLOWED_EXTENSIONS)} allowed."
        )
    
    # Validate file size
    contents = await image.read()
    if len(contents) > config.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {config.MAX_FILE_SIZE // 1024 // 1024}MB."
        )
    
    # Generate unique filename
    timestamp = int(time.time())
    unique_filename = f"wound_{timestamp}_{os.urandom(4).hex()}{file_extension}"
    upload_path = os.path.join(config.UPLOAD_DIR, unique_filename)
    
    # Save file
    try:
        with open(upload_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")
    
    # Save to database
    try:
        wound = Wound(
            user_id=user_id,
            case_id=case_id if case_id else None,
            image_path=upload_path,
            original_filename=image.filename,
            status="pending"
        )
        db.add(wound)
        db.commit()
        db.refresh(wound)
        
        return WoundUploadResponse(
            success=True,
            wound_id=wound.id,
            image_path=upload_path,
            message="Image uploaded successfully"
        )
    except Exception as e:
        # Clean up file if database insert fails
        if os.path.exists(upload_path):
            os.remove(upload_path)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
