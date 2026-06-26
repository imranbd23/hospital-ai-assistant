from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from app.models.all_models import UserRole, ConsultationStatus


# ==================== TOKEN SCHEMAS ====================
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


# ==================== USER SCHEMAS ====================
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.DOCTOR


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== MEDICAL RECORD SCHEMAS ====================
class MedicalRecordBase(BaseModel):
    record_type: str
    summary: str
    file_url: Optional[str] = None


class MedicalRecordCreate(MedicalRecordBase):
    pass


class MedicalRecordResponse(MedicalRecordBase):
    id: int
    patient_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== CONSULTATION SCHEMAS ====================
class ConsultationBase(BaseModel):
    symptoms: str
    clinical_notes: Optional[str] = None
    status: ConsultationStatus = ConsultationStatus.PENDING


class ConsultationCreate(ConsultationBase):
    patient_id: int


class ConsultationUpdate(BaseModel):
    symptoms: Optional[str] = None
    clinical_notes: Optional[str] = None
    ai_summary: Optional[str] = None
    diagnosis_suggestion: Optional[str] = None
    status: Optional[ConsultationStatus] = None
    doctor_id: Optional[int] = None


class ConsultationResponse(ConsultationBase):
    id: int
    patient_id: int
    doctor_id: Optional[int] = None
    ai_summary: Optional[str] = None
    diagnosis_suggestion: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== PATIENT SCHEMAS ====================
class PatientBase(BaseModel):
    full_name: str
    date_of_birth: str = Field(..., description="Date of Birth in YYYY-MM-DD")
    gender: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    medical_history: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    medical_history: Optional[str] = None


class PatientResponse(PatientBase):
    id: int
    created_at: datetime
    updated_at: datetime
    consultations: List[ConsultationResponse] = []
    medical_records: List[MedicalRecordResponse] = []

    class Config:
        from_attributes = True


# ==================== AI ENDPOINT SCHEMAS ====================
class AIConsultRequest(BaseModel):
    symptoms: str
    patient_history: Optional[str] = None


class AIConsultResponse(BaseModel):
    suggested_diagnosis: str
    recommended_tests: List[str]
    suggested_specialists: List[str]
    ai_summary: str
