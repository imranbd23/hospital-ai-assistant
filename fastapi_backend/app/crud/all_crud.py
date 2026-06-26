from typing import List, Optional, Type
from sqlalchemy.orm import Session
from app.models.all_models import User, Patient, Consultation, MedicalRecord, UserRole
from app.schemas.all_schemas import UserCreate, UserUpdate, PatientCreate, PatientUpdate, ConsultationCreate, ConsultationUpdate, MedicalRecordCreate
from app.core.security import get_password_hash, verify_password


# ==================== USER CRUD ====================
class CRUDUser:
    def get(self, db: Session, id: int) -> Optional[User]:
        return db.query(User).filter(User.id == id).first()

    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    def create(self, db: Session, obj_in: UserCreate) -> User:
        db_obj = User(
            email=obj_in.email,
            hashed_password=get_password_hash(obj_in.password),
            full_name=obj_in.full_name,
            role=obj_in.role,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: User, obj_in: UserUpdate) -> User:
        update_data = obj_in.model_dump(exclude_unset=True)
        if "password" in update_data and update_data["password"]:
            update_data["hashed_password"] = get_password_hash(update_data["password"])
            del update_data["password"]
            
        for field, value in update_data.items():
            setattr(db_obj, field, value)
            
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def authenticate(self, db: Session, email: str, password: str) -> Optional[User]:
        user = self.get_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user


# ==================== PATIENT CRUD ====================
class CRUDPatient:
    def get(self, db: Session, id: int) -> Optional[Patient]:
        return db.query(Patient).filter(Patient.id == id).first()

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100) -> List[Patient]:
        return db.query(Patient).offset(skip).limit(limit).all()

    def create(self, db: Session, obj_in: PatientCreate) -> Patient:
        db_obj = Patient(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Patient, obj_in: PatientUpdate) -> Patient:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, id: int) -> Optional[Patient]:
        obj = db.query(Patient).get(id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj


# ==================== CONSULTATION CRUD ====================
class CRUDConsultation:
    def get(self, db: Session, id: int) -> Optional[Consultation]:
        return db.query(Consultation).filter(Consultation.id == id).first()

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100) -> List[Consultation]:
        return db.query(Consultation).offset(skip).limit(limit).all()

    def get_by_patient(self, db: Session, patient_id: int) -> List[Consultation]:
        return db.query(Consultation).filter(Consultation.patient_id == patient_id).all()

    def create(self, db: Session, obj_in: ConsultationCreate, doctor_id: Optional[int] = None) -> Consultation:
        db_obj = Consultation(
            patient_id=obj_in.patient_id,
            doctor_id=doctor_id,
            symptoms=obj_in.symptoms,
            clinical_notes=obj_in.clinical_notes,
            status=obj_in.status,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Consultation, obj_in: ConsultationUpdate) -> Consultation:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


# Instantiate singleton CRUD accessors
user_crud = CRUDUser()
patient_crud = CRUDPatient()
consult_crud = CRUDConsultation()
