from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Wound, Classification
from models import ClassifyRequest, ClassificationResponse
import google.generativeai as genai
from config import config
import json
import time
from pathlib import Path

router = APIRouter()

# Configure Gemini
genai.configure(api_key=config.GEMINI_API_KEY)

@router.post("/classify", response_model=ClassificationResponse)
async def classify_wound(
    request: ClassifyRequest,
    db: Session = Depends(get_db)
):
    """Classify wound using Gemini Vision API"""
    
    # Get wound from database
    wound = db.query(Wound).filter(Wound.id == request.wound_id).first()
    if not wound:
        raise HTTPException(status_code=404, detail="Wound not found")
    
    # Check if image exists
    if not Path(wound.image_path).exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    
    try:
        start_time = time.time()
        
        # Upload image to Gemini
        uploaded_file = genai.upload_file(wound.image_path)
        
        # Create prompt for wound classification
        prompt = """Act as a specialized Wound Care AI. Your task is to calculate the TISSUE COMPOSITION with extreme cynicism.

CRITICAL INSTRUCTION: DO NOT HALLUCINATE HEALTHY TISSUE.
Most AI models incorrectly classify pale yellow/white slough as "Pink Epithelial Tissue". You must NOT do this.

STRICT TISSUE DEFINITIONS:
1. **RED (Granulation)**:
   - MUST be beefy red, bloody, moist, and bumpy (like raspberry).
   - If it is pale red or orange, it is SLOUGH.

2. **PINK (Epithelial)**:
   - **RESTRICTED**: Only visible at the very edges of the wound (silvery/translucent skin).
   - **FORBIDDEN**: Do NOT classify the center of the wound as Pink.
   - **RULE**: If the tissue is Pale, Whitish, Cream, or Yellowish -> IT IS SLOUGH. IT IS NOT PINK.

3. **BLACK (Necrotic)**:
   - Hard, dry, leathery, dark brown/black.

4. **YELLOW/WHITE (Slough)**:
   - **SUBTRACTION LOGIC**: Anything that is NOT clearly Beefy Red or Dead Black is SLOUGH.
   - Includes: Pale yellow, creamy white, grey, beige, tan, soft fibrinous tissue.
   - **GLARE**: If you see white glare, counting it as Slough is safer than counting it as Pink.

TASK:
1. Identify the wound bed.
2. Aggressively look for SLOUGH (Yellow/White/Pale). It is likely the majority tissue in chronic wounds.
3. Only mark TISSUE as "Pink" if it is clear, healed skin at the margins.
4. Calculate Percentages that sum to 100%.

Provide your response in this exact JSON format:
{
  "wound_type": "category name",
  "confidence": 0-100,
  "probabilities": {
    "Normal Healing": 0-100,
    "Delayed Healing": 0-100,
    "Infection Risk": 0-100,
    "Active Infection": 0-100,
    "High Urgency": 0-100
  },
  "redness_level": 0-100,
  "discharge_detected": true/false,
  "discharge_type": "none/clear/yellow/green/bloody",
  "edge_quality": 0-100,
  "tissue_composition": {
    "red": 0-100,
    "pink": 0-100,
    "yellow": 0-100,
    "black": 0-100,
    "white": 0-100
  },
  "wound_location": "description",
  "notes": "Explain your calculation: e.g., 'Central pale area is Slough (Yellow), not Pink.'"
}"""
        
        # Try available Flash models (VERIFIED WORKING)
        model_names = [
            'models/gemini-2.5-flash', 
            'models/gemini-flash-latest', 
            'models/gemini-2.0-flash-lite',
            'models/gemini-3-flash-preview',
            'models/gemini-1.5-flash', 
            'models/gemini-1.5-flash-8b'
        ]
        response = None
        last_error = None
        
        for m_name in model_names:
            try:
                model = genai.GenerativeModel(m_name)
                response = model.generate_content(
                    [uploaded_file, prompt],
                    generation_config={"response_mime_type": "application/json"}
                )
                if response:
                    break
            except Exception as e:
                last_error = e
                continue
        
        if not response:
            raise last_error or Exception("All Gemini models failed")
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Parse response
        response_text = response.text.strip()
        
        # Robust JSON extraction
        try:
            result = json.loads(response_text)
        except json.JSONDecodeError:
            # Fallback: extract substring between { and }
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(response_text[start:end])
            else:
                raise
        
        # Save classification to database
        classification = Classification(
            wound_id=wound.id,
            wound_type=result.get("wound_type", "Unknown"),
            confidence=result.get("confidence", 0),
            all_probabilities=result.get("probabilities", {}),
            processing_time_ms=processing_time
        )
        db.add(classification)
        
        # Update wound record
        wound.status = "analyzed"
        wound.classification = result.get("wound_type")
        wound.confidence = result.get("confidence")
        wound.redness_level = result.get("redness_level")
        wound.discharge_detected = result.get("discharge_detected")
        wound.discharge_type = result.get("discharge_type")
        wound.edge_quality = result.get("edge_quality")
        wound.tissue_composition = result.get("tissue_composition")
        wound.analysis = result
        
        db.commit()
        db.refresh(classification)
        
        # ---------------------------------------------------------
        # DETERMINISTIC OVERRIDE: Force Classification based on Tissue
        # ---------------------------------------------------------
        t_comp = result.get("tissue_composition", {})
        p_pink = t_comp.get("pink", 0)
        p_red = t_comp.get("red", 0)
        p_yellow = t_comp.get("yellow", 0)
        p_black = t_comp.get("black", 0)
        p_white = t_comp.get("white", 0)
        
        total_slough = p_yellow + p_white
        total_necrosis = p_black
        
        # Default to AI's analysis, but override if logic dictates
        final_wound_type = result.get("wound_type", "Unknown")
        final_probabilities = result.get("probabilities", {})
        
        if total_necrosis >= 10:
            final_wound_type = "High Urgency"
            final_probabilities["High Urgency"] = 100
        elif total_slough >= 20:
            if result.get("discharge_detected") and result.get("discharge_type") in ["yellow", "green"]:
                 final_wound_type = "Active Infection"
                 final_probabilities["Active Infection"] = 90
            else:
                 final_wound_type = "Delayed Healing"
                 final_probabilities["Delayed Healing"] = 90
        elif total_slough >= 5 and "Normal" in final_wound_type:
             # Prevent "Normal" tag if visible slough exists
             final_wound_type = "Delayed Healing"
             final_probabilities["Delayed Healing"] = 80
             
        # Apply override
        result["wound_type"] = final_wound_type
        result["probabilities"] = final_probabilities
        # ---------------------------------------------------------

        return ClassificationResponse(
            success=True,
            classification_id=classification.id,
            wound_type=final_wound_type,
            confidence=result.get("confidence"),
            probabilities=final_probabilities,
            redness_level=result.get("redness_level"),
            discharge_detected=result.get("discharge_detected"),
            discharge_type=result.get("discharge_type"),
            edge_quality=result.get("edge_quality"),
            tissue_composition=result.get("tissue_composition"),
            wound_location=result.get("wound_location"),
            processing_time_ms=processing_time
        )
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")
