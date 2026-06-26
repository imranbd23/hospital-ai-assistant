import os
from typing import Optional, List, Dict, Any
import json
from google import genai
from google.genai import types
from app.core.config import settings


class ClinicalAIService:
    def __init__(self):
        # Initialize Google GenAI client securely using key from config
        self.api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        self.client = None
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)

    def analyze_symptoms(
        self, symptoms: str, patient_history: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Interacts with Gemini to return structured, clinical analysis of patient symptoms,
        including suggested diagnoses, recommended secondary tests, and suggested medical specialties.
        """
        if not self.client:
            # Fallback mock for local development environments lacking API Keys
            return {
                "suggested_diagnosis": "Symptom analysis requires an active GEMINI_API_KEY.",
                "recommended_tests": ["Complete Blood Count (CBC)", "Basic Metabolic Panel (BMP)"],
                "suggested_specialists": ["General Practitioner"],
                "ai_summary": "Please configure GEMINI_API_KEY to access high-fidelity diagnostics suggestions."
            }

        prompt = f"""
        You are an advanced Hospital clinical assistant. Analyze the following patient case:
        Patient Current Symptoms: {symptoms}
        Patient Chronic/Medical History: {patient_history or 'None reported'}

        Please provide a highly-structured clinical analysis. You must output a JSON object with the following fields:
        - suggested_diagnosis: A clear, professional medical diagnosis suggestion, noting probabilities.
        - recommended_tests: A list of laboratory, imaging, or physical tests recommended to confirm diagnosis.
        - suggested_specialists: A list of clinical departments or specialties appropriate for this case.
        - ai_summary: A concise, medical-grade summary of the case, highlighting warning signs (red flags).
        """

        try:
            response = self.client.models.generate_content(
                model="gemini-3.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            
            # Extract and parse the response text as JSON
            return json.loads(response.text)
        except Exception as e:
            # Safe recovery fallback
            return {
                "suggested_diagnosis": f"Error interacting with AI Service: {str(e)}",
                "recommended_tests": ["Please consult clinician"],
                "suggested_specialists": ["Triage Nurse"],
                "ai_summary": "System error. AI consultation processing failed."
            }


# Singleton clinical AI service
clinical_ai = ClinicalAIService()
