from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db, Wound, Classification, Recommendation, Case
from models import HistoryResponse, CaseResponse, CreateCaseRequest
from typing import Optional

router = APIRouter()

@router.get("/history", response_model=HistoryResponse)
async def get_history(
    user_id: int = Query(1),
    case_id: Optional[int] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    """Get wound history with classifications and recommendations"""
    
    # Build query
    query = db.query(Wound).filter(Wound.user_id == user_id)
    
    if case_id:
        query = query.filter(Wound.case_id == case_id)
    
    # Get total count
    total = query.count()
    
    # Get wounds with pagination
    wounds = query.order_by(Wound.upload_date.desc()).offset(offset).limit(limit).all()
    
    # Format response
    wounds_data = []
    for wound in wounds:
        # Get classification
        classification = db.query(Classification).filter(
            Classification.wound_id == wound.id
        ).first()
        
        # Get recommendation
        recommendation = None
        if classification:
            rec = db.query(Recommendation).filter(
                Recommendation.classification_id == classification.id
            ).first()
            if rec:
                recommendation = {
                    "summary": rec.summary,
                    "cleaning_instructions": rec.cleaning_instructions,
                    "dressing_recommendations": rec.dressing_recommendations,
                    "warning_signs": rec.warning_signs
                }
        
        # Normalize image path for web (convert backslashes to forward slashes, remove ./ prefix)
        img_path = wound.image_path.replace('\\', '/')
        if img_path.startswith('./'):
            img_path = img_path[2:]  # Remove ./ prefix
        
        wound_data = {
            "wound_id": wound.id,
            "case_id": wound.case_id,
            "image_path": img_path,
            "original_filename": wound.original_filename,
            "upload_date": wound.upload_date.isoformat(),
            "status": wound.status,
            "analysis": wound.analysis,
            "redness_level": wound.redness_level,
            "discharge_detected": wound.discharge_detected,
            "discharge_type": wound.discharge_type,
            "edge_quality": wound.edge_quality,
            "tissue_composition": wound.tissue_composition,
            "classification": {
                "classification_id": classification.id,
                "wound_type": classification.wound_type,
                "confidence": classification.confidence,
                "probabilities": classification.all_probabilities
            } if classification else (
                {"wound_type": wound.classification, "confidence": wound.confidence} 
                if wound.classification else None
            ),
            "recommendation": recommendation
        }
        wounds_data.append(wound_data)
    
    return HistoryResponse(
        success=True,
        wounds=wounds_data,
        total=total,
        limit=limit,
        offset=offset
    )


@router.post("/create_case", response_model=CaseResponse)
async def create_case(
    request: CreateCaseRequest,
    db: Session = Depends(get_db)
):
    """Create a new wound case"""
    
    case = Case(
        user_id=request.user_id,
        name=request.name,
        description=request.description
    )
    
    db.add(case)
    db.commit()
    db.refresh(case)
    
    return CaseResponse(
        success=True,
        case={
            "id": case.id,
            "user_id": case.user_id,
            "name": case.name,
            "description": case.description,
            "created_at": case.created_at.isoformat()
        }
    )


@router.get("/cases", response_model=CaseResponse)
async def get_cases(
    user_id: int = Query(1),
    db: Session = Depends(get_db)
):
    """Get all cases for a user"""
    
    cases = db.query(Case).filter(Case.user_id == user_id).order_by(Case.created_at.desc()).all()
    
    cases_data = []
    for case in cases:
        # Count wounds in this case
        wound_count = db.query(Wound).filter(Wound.case_id == case.id).count()
        
        # Get latest wound image
        latest_wound = db.query(Wound).filter(Wound.case_id == case.id).order_by(
            Wound.upload_date.desc()
        ).first()
        
        # Normalize path for web (convert backslashes to forward slashes, remove ./ prefix)
        latest_image = None
        if latest_wound:
            img_path = latest_wound.image_path.replace('\\', '/')
            if img_path.startswith('./'):
                img_path = img_path[2:]  #Remove ./ prefix
            latest_image = img_path
        
        cases_data.append({
            "id": case.id,
            "name": case.name,
            "description": case.description,
            "created_at": case.created_at.isoformat(),
            "wound_count": wound_count,
            "latest_image": latest_image
        })
    
    return CaseResponse(
        success=True,
        cases=cases_data
    )


@router.delete("/wounds/{wound_id}")
async def delete_wound(
    wound_id: int,
    db: Session = Depends(get_db)
):
    """Delete a wound record and its associated classifications and recommendations"""

    wound = db.query(Wound).filter(Wound.id == wound_id).first()
    if not wound:
        raise HTTPException(status_code=404, detail="Wound not found")

    # Delete child recommendations → classifications → wound (cascade order)
    classifications = db.query(Classification).filter(Classification.wound_id == wound_id).all()
    for clf in classifications:
        db.query(Recommendation).filter(Recommendation.classification_id == clf.id).delete()
    db.query(Classification).filter(Classification.wound_id == wound_id).delete()
    db.delete(wound)
    db.commit()

    return {"success": True, "message": f"Wound {wound_id} deleted"}


@router.delete("/cases/{case_id}")
async def delete_case(
    case_id: int,
    db: Session = Depends(get_db)
):
    """Delete a case and all its wounds, classifications, and recommendations"""

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Delete all wounds in this case and their children
    wounds = db.query(Wound).filter(Wound.case_id == case_id).all()
    for wound in wounds:
        classifications = db.query(Classification).filter(Classification.wound_id == wound.id).all()
        for clf in classifications:
            db.query(Recommendation).filter(Recommendation.classification_id == clf.id).delete()
        db.query(Classification).filter(Classification.wound_id == wound.id).delete()
        db.delete(wound)

    db.delete(case)
    db.commit()

    return {"success": True, "message": f"Case {case_id} and all its wounds deleted"}

