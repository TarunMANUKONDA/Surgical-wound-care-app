from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Wound, Comparison
from models import CompareRequest, ComparisonResponse, SaveComparisonRequest
import google.generativeai as genai
from config import config
import json
from pathlib import Path

router = APIRouter()

# Configure Gemini
genai.configure(api_key=config.GEMINI_API_KEY)

@router.post("/compare", response_model=ComparisonResponse)
async def compare_wounds(
    request: CompareRequest,
    db: Session = Depends(get_db)
):
    """Compare two wounds using Gemini Vision API"""
    
    # Get both wounds
    base_wound = db.query(Wound).filter(Wound.id == request.base_wound_id).first()
    current_wound = db.query(Wound).filter(Wound.id == request.current_wound_id).first()
    
    if not base_wound or not current_wound:
        raise HTTPException(status_code=404, detail="One or both wounds not found")
    
    # Check if images exist
    if not Path(base_wound.image_path).exists() or not Path(current_wound.image_path).exists():
        raise HTTPException(status_code=404, detail="One or both image files not found")
    
    try:
        # Upload images to Gemini
        base_file = genai.upload_file(base_wound.image_path)
        current_file = genai.upload_file(current_wound.image_path)
        
        # Create comparison prompt
        prompt = """Compare these two surgical wound images (first image is the baseline, second is current state).

Provide a detailed comparative analysis in JSON format:
{
  "overallAssessment": "improving/stable/worsening",
  "healingProgress": 0-100,
  "sizeChange": "percentage change",
  "colorChange": "description of tissue color changes",
  "inflammationChange": "increased/decreased/stable",
  "dischargeChange": "improved/worsened/no change",
  "edgeHealing": "description of wound edge changes",
  "riskLevel": "low/moderate/high",
  "recommendations": ["array of specific recommendations"],
  "concerningChanges": ["array of concerning observations"],
  "positiveChanges": ["array of improvements"],
  "summary": "overall comparison summary",
  "confidence": 0-100
}"""
        
        # Call Gemini API with both images
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content([base_file, current_file, prompt])
        
        response_text = response.text.strip()
        
        # Extract JSON from response
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        result = json.loads(response_text)
        
        return ComparisonResponse(
            success=True,
            comparison=result
        )
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


@router.post("/save_comparison")
async def save_comparison(
    request: SaveComparisonRequest,
    db: Session = Depends(get_db)
):
    """Save comparison analysis to database"""
    
    comparison = Comparison(
        case_id=request.case_id,
        wound_id_before=request.wound_id_before,
        wound_id_after=request.wound_id_after,
        analysis=request.analysis
    )
    
    db.add(comparison)
    db.commit()
    
    return {"success": True, "message": "Comparison saved"}


@router.post("/save_analysis")
async def save_analysis(
    request: dict,
    db: Session = Depends(get_db)
):
    """Save or update wound analysis"""
    
    wound_id = request.get("wound_id")
    analysis = request.get("analysis")
    
    if not wound_id or not analysis:
        raise HTTPException(status_code=400, detail="Missing wound_id or analysis")
    
    wound = db.query(Wound).filter(Wound.id == wound_id).first()
    if not wound:
        raise HTTPException(status_code=404, detail="Wound not found")
    
    wound.analysis = analysis
    db.commit()
    
    return {"success": True, "message": "Analysis saved"}
