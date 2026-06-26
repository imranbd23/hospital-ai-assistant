from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List

from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.models.all_models import User, Patient, Consultation, MedicalRecord, UserRole
from app.schemas.all_schemas import (
    Token, UserCreate, UserResponse, PatientCreate, PatientResponse,
    ConsultationCreate, ConsultationResponse, ConsultationUpdate,
    AIConsultRequest, AIConsultResponse
)
from app.crud.all_crud import user_crud, patient_crud, consult_crud
from app.core.security import create_access_token, verify_token
from app.services.gemini import clinical_ai

# Initialize database tables (In a production environment, use Alembic migrations instead)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="FastAPI Backend for Hospital Clinical Assistant. Integrates JWT, PostgreSQL, and Gemini AI.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token")


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    """
    Dependency to secure endpoints. Decodes the JWT token and verifies the user exists.
    """
    email = verify_token(token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = user_crud.get_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


# ==================== HEALTH & UTILS ====================
@app.get("/health", tags=["Health"])
def health_check():
    """Service health monitoring check."""
    return {"status": "healthy", "database": "connected"}


# ==================== AUTHENTICATION ====================
@app.post(f"{settings.API_V1_STR}/auth/register", response_model=UserResponse, tags=["Auth"])
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """Registers a new clinician or clinical staff user."""
    user = user_crud.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists in the system.",
        )
    return user_crud.create(db, obj_in=user_in)


@app.post(f"{settings.API_V1_STR}/auth/token", response_model=Token, tags=["Auth"])
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticates user credentials and issues a secure JWT access token."""
    user = user_crud.authenticate(db, email=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(subject=user.email)
    return {"access_token": access_token, "token_type": "bearer"}


# ==================== PATIENTS ====================
@app.post(f"{settings.API_V1_STR}/patients", response_model=PatientResponse, tags=["Patients"])
def create_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new patient medical record. Requires JWT authentication."""
    return patient_crud.create(db, obj_in=patient_in)


@app.get(f"{settings.API_V1_STR}/patients", response_model=List[PatientResponse], tags=["Patients"])
def read_patients(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists patients in the database. Requires JWT authentication."""
    return patient_crud.get_multi(db, skip=skip, limit=limit)


@app.get(f"{settings.API_V1_STR}/patients/{{patient_id}}", response_model=PatientResponse, tags=["Patients"])
def read_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves full medical record of a specific patient."""
    patient = patient_crud.get(db, id=patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


# ==================== CLINICAL CONSULTATIONS ====================
@app.post(f"{settings.API_V1_STR}/consultations", response_model=ConsultationResponse, tags=["Consultations"])
def create_consultation(
    consult_in: ConsultationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Registers a new clinic consultation session for a patient."""
    patient = patient_crud.get(db, id=consult_in.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Associated patient not found")
    return consult_crud.create(db, obj_in=consult_in, doctor_id=current_user.id)


@app.get(f"{settings.API_V1_STR}/consultations/{{consult_id}}", response_model=ConsultationResponse, tags=["Consultations"])
def read_consultation(
    consult_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves details of a clinical consultation."""
    consult = consult_crud.get(db, id=consult_id)
    if not consult:
        raise HTTPException(status_code=404, detail="Consultation session not found")
    return consult


# ==================== MEDICAL INTELLIGENCE (AI) ====================
@app.post(f"{settings.API_V1_STR}/ai/analyze", response_model=AIConsultResponse, tags=["Clinical Intelligence"])
def analyze_patient_symptoms(
    request: AIConsultRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Leverages Gemini AI on the server-side to analyze symptoms against historical context.
    Provides suggested diagnoses, primary diagnostic labs, and medical specialties.
    """
    analysis = clinical_ai.analyze_symptoms(
        symptoms=request.symptoms,
        patient_history=request.patient_history
    )
    return analysis
