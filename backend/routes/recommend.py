from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Classification, Recommendation
from models import RecommendRequest, RecommendationResponse
import google.generativeai as genai
from config import config
import json

router = APIRouter()

# Configure Gemini
genai.configure(api_key=config.GEMINI_API_KEY)

@router.post("/recommend", response_model=RecommendationResponse)
async def get_recommendations(
    request: RecommendRequest,
    db: Session = Depends(get_db)
):
    """Get AI-powered care recommendations using Gemini"""
    
    # Verify classification exists
    classification = db.query(Classification).filter(
        Classification.id == request.classification_id
    ).first()
    
    if not classification:
        raise HTTPException(status_code=404, detail="Classification not found")
    
    try:
        # Build prompt
        # --- RISK ASSESSMENT SYSTEM ---
        
        # 1. Get/Estimate Tissue Composition
        tissue = classification.wound.tissue_composition
        
        # Only use heuristics if tissue composition is completely missing
        if not tissue or not isinstance(tissue, dict):
            # Heuristic estimation based on wound type (FALLBACK ONLY)
            w_type = request.wound_type.lower()
            if "normal" in w_type or "healing" in w_type:
                tissue = {"pink": 70, "red": 30, "yellow": 0, "black": 0, "white": 0}
            elif "delayed" in w_type:
                tissue = {"pink": 30, "red": 40, "yellow": 30, "black": 0, "white": 0}
            elif "infection" in w_type:
                tissue = {"pink": 0, "red": 50, "yellow": 40, "black": 10, "white": 0}
            elif "urgency" in w_type or "critical" in w_type:
                tissue = {"pink": 0, "red": 20, "yellow": 30, "black": 50, "white": 0}
            else:
                tissue = {"pink": 50, "red": 50, "yellow": 0, "black": 0, "white": 0}
        
        # Normalize tissue composition to ensure it sums to ~100 (in case AI gives weird values)
        pink = float(tissue.get("pink", 0))
        red = float(tissue.get("red", 0))
        yellow = float(tissue.get("yellow", 0))
        black = float(tissue.get("black", 0))
        white = float(tissue.get("white", 0))
        
        total = pink + red + yellow + black + white
        if total > 0 and total != 100:
            # Normalize to 100
            factor = 100 / total
            pink = round(pink * factor, 1)
            red = round(red * factor, 1)
            yellow = round(yellow * factor, 1)
            black = round(black * factor, 1)
            white = round(white * factor, 1)
        
        # Update tissue dict with normalized values
        tissue = {
            "pink": pink,
            "red": red,
            "yellow": yellow,
            "black": black,
            "white": white
        }

        # 2. Compute Severity Score
        # Weights: Necrotic(Black)=3, Slough(Yellow/White)=2, Active(Red)=1, Healthy(Pink)=0
        severity_score = (black * 3) + ((yellow + white) * 2) + (red * 1)
        
        # 3. Map to Severity Level
        if severity_score < 50:
            severity_level = "Low"
        elif severity_score < 100:
            severity_level = "Moderate"
        elif severity_score < 200:
            severity_level = "High"
        else:
            severity_level = "Critical"

        # 4. SAFETY OVERRIDES (Deterministic)
        # Force Risk Level based on Tissue thresholds, regardless of score
        risk_override = False
        
        # Necrosis Rule
        if black >= 10:
            severity_level = "Critical"
            risk_override = True
            
        # Slough Rule (Yellow + White)
        elif (yellow + white) >= 20: 
            severity_level = "High"
            risk_override = True
            
        # Infection Rule (Pus detected)
        elif request.discharge_detected and request.discharge_type in ["yellow", "green"]:
            severity_level = "High"
            risk_override = True
            
        # Delayed Healing Rule (Any visible slough)
        elif (yellow + white) >= 5 and severity_level == "Low":
            severity_level = "Moderate"
            severity_score = max(severity_score, 60)
            risk_override = True

        # ---------------------------------------------------------
        # 5a. SYMPTOM-BASED RISK OVERRIDES (New)
        # ---------------------------------------------------------
        symptoms_context = ""
        if request.fever:
             severity_level = "Critical"
             risk_override = True
             symptoms_context += "- **FEVER REPORTED**: Systemic infection risk.\n"
        
        if request.redness_spread:
             severity_level = "High" 
             risk_override = True
             symptoms_context += "- **SPREADING REDNESS**: Possible Cellulitis.\n"

        if request.pain_level == 'severe':
             symptoms_context += "- **SEVERE PAIN**: Unusual for normal healing.\n"
             if severity_level == "Low":
                  severity_level = "Moderate"
                  risk_override = True

        if request.discharge_type in ["yellow", "green", "bloody"]:
             symptoms_context += f"- **DISCHARGE**: {request.discharge_type.upper()} fluid detected.\n"

        # 5b. PRECAUTIONARY CHECKS (New)
        if 5 <= (yellow + white) < 20:
             symptoms_context += "- **MINOR SLOUGH DETECTED**: Precaution required. Clean wound to prevent buildup.\n"

        # 5. GENERATE CLINICAL GUIDELINES HINT
        clinical_hint = "FOCUS: General wound hygiene and protection."
        
        if "CRITICAL" in severity_level or black >= 10:
             clinical_hint = "FOCUS: URGENT MEDICAL REVIEW. Potential Necrosis/Gangrene/Sepsis. Emphasize need for immediate professional assessment."
        elif "Infection" in request.wound_type or (request.discharge_detected and request.discharge_type in ["yellow", "green", "bloody"]) or request.fever:
             clinical_hint = "FOCUS: INFECTION CONTROL. Systemic signs (Fever) require antibiotics. Local signs (Pus) require antimicrobial dressings."
        elif (yellow + white) >= 20:
             clinical_hint = "FOCUS: DESLOUGHING (Autolytic Debridement). Use Hydrogels or Alginates to soften slough. Keep wound moist but not macerated."
        elif red > 50 or "dehiscence" in request.wound_type.lower() or "open" in request.wound_type.lower():
             clinical_hint = "FOCUS: OPEN WOUND CARE. Emphasize CLEANING and BANDAGING to protect the granulated bed. Use non-adherent dressings."
        elif pink > 50:
             clinical_hint = "FOCUS: EPITHELIALIZATION. Protect delicate new skin. Low-adherence dressing. Minimal cleaning required."

        # Build context for AI
        assessment_context = f"""
        RISK ASSESSMENT DATA:
        - Classified Type: {request.wound_type} (Confidence: {request.confidence}%)
        - Tissue Composition (Estimated/Actual): {json.dumps(tissue)}
        - Calculated Severity Score: {severity_score:.1f} (Scale: 0-300)
        - Risk Level: {severity_level}
        - Safety Override Applied: {"YES" if risk_override else "NO"}
        
        PATIENT REPORTED SYMPTOMS & OBSERVATIONS:
        {symptoms_context if symptoms_context else "- None reported"}
        
        CLINICAL STRATEGY TO APPLY:
        {clinical_hint}
        """

        # Build prompt
        prompt = f"""You are an advanced surgical wound care AI assistant. 
Use the following Risk Assessment Data to generate specific, medical-grade recommendations.

{assessment_context}

IMPORTANT INSTRUCTIONS:
1. **STRATEGY**: STRICTLY follow the "CLINICAL STRATEGY TO APPLY" listed above.
2. **CLEANING**:
   - If Sloughy: Recommend gentle irrigation/wiping to remove debris.
   - If Necrotic: Warn against soaking dry eschar (unless supervised).
   - If Granulating: "Touch only if necessary" to avoid bleeding.
3. **DRESSING**: 
   - Recommend specific types (Hydrogel, Alginate, Foam, Honey, Silver) based on the tissue.
   - Do NOT just say "bandage". Be specific.
4. **SUMMARY**: Start with a bold statement about the primary issue (e.g., "High Slough detected - requires debridement").

Provide the response in this exact JSON format:
- summary (string): Comprehensive assessment summary including the risk level and clinical focus.
- cleaningInstructions (array of strings): Specific cleaning steps tailored to the tissue.
- dressingRecommendations (array of strings): Specific dressing products (generic names) suitable for the phase.
- warningsSigns (array of strings): Specific signs to watch for (e.g. "spreading redness", "bad odor").
- whenToSeekHelp (array of strings): Urgent triggers based on risk level.
- dietAdvice (array of strings): Nutrition for wound healing (Protein, Vit C, Zinc).
- activityRestrictions (array of strings): Activities to avoid.
- expectedHealingTime (string): Realistic timeline (e.g. "Weeks to Months" for sloughy wounds).
- followUpSchedule (array of strings): Recommended follow-up frequency.
- confidence (number): 0-100 logic confidence.
"""

        # Call Gemini API
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        
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
        
        # Save recommendation to database
        recommendation = Recommendation(
            classification_id=request.classification_id,
            summary=result.get("summary", "No summary provided"),
            cleaning_instructions=result.get("cleaningInstructions", []),
            dressing_recommendations=result.get("dressingRecommendations", []),
            warning_signs=result.get("warningsSigns", []),
            when_to_seek_help=result.get("whenToSeekHelp", []),
            diet_advice=result.get("dietAdvice", []),
            activity_restrictions=result.get("activityRestrictions", []),
            expected_healing_time=result.get("expectedHealingTime", "Variable"),
            follow_up_schedule=result.get("followUpSchedule", []),
            ai_confidence=result.get("confidence", 75)
        )
        
        db.add(recommendation)
        db.commit()
        db.refresh(recommendation)
        
        return RecommendationResponse(
            success=True,
            recommendation_id=recommendation.id,
            recommendation=result,
            risk_level=severity_level,
            severity_score=float(severity_score),
            tissue_composition=tissue
        )
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {str(e)}")
