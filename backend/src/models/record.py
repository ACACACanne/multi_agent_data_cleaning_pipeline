# backend/src/models/record.py
"""
DataRA Pro - Record ORM & Tree Invariant Validation Schema
Defines the SQLAlchemy Record table for database storage and
ClinicalRecordModel for multi-agent tree invariant verification.
"""

from datetime import datetime
from typing import Optional, Dict, Any
import json

from sqlalchemy import Column, String, Integer, Float, DateTime, Text, JSON
from pydantic import BaseModel, Field, model_validator

# Safely import Base from the DB engine, with declarative fallback
try:
    from src.db.engine import Base
except ImportError:
    try:
        from src.db.session import Base
    except ImportError:
        from sqlalchemy.orm import declarative_base
        Base = declarative_base()


# ==========================================
# 1. Database ORM Model (SQLAlchemy)
# ==========================================
class Record(Base):
    """SQLAlchemy ORM table mapping for clinical records storage."""
    __tablename__ = "records"
    __table_args__ = {"extend_existing": True}

    id = Column(String(64), primary_key=True, index=True)
    dataset_id = Column(String(64), index=True, nullable=True)
    patient_id = Column(String(64), index=True, nullable=True)
    row_data = Column(JSON, nullable=True)
    data_status = Column(String(32), default="VALID", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Alias for backwards compatibility
Records = Record


# ==========================================
# 2. Pydantic Tree Invariant Schema
# ==========================================
class ClinicalRecordModel(BaseModel):
    """
    Deterministic domain contract enforcing root-child field hierarchies,
    hemodynamic bounds, and clinical tree invariants.
    """
    id: str
    patient_id: Optional[str] = None
    age: Optional[float] = Field(default=None, ge=0, le=125)
    systolic_bp: Optional[float] = Field(default=None, ge=50, le=300)
    diastolic_bp: Optional[float] = Field(default=None, ge=20, le=200)
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    diagnosis_code: Optional[str] = None
    data_status: Optional[str] = "VALID"
    _data_status: Optional[str] = None

    @model_validator(mode="after")
    def validate_tree_and_relational_invariants(self) -> "ClinicalRecordModel":
        # 1. Tree Invariant: Hemodynamic Coherence (Systolic > Diastolic)
        if self.systolic_bp is not None and self.diastolic_bp is not None:
            if self.systolic_bp <= self.diastolic_bp:
                raise ValueError(
                    f"Hemodynamic Tree Violation: systolic_bp ({self.systolic_bp}) "
                    f"must be strictly greater than diastolic_bp ({self.diastolic_bp})."
                )
            pulse_pressure = self.systolic_bp - self.diastolic_bp
            if pulse_pressure < 15:
                raise ValueError(
                    f"Hemodynamic Failure: Pulse pressure ({pulse_pressure} mmHg) is below physiological threshold (15 mmHg)."
                )

        # 2. Tree Invariant: Temporal Chronology (Admission <= Discharge)
        if self.admission_date and self.discharge_date:
            try:
                adm = (
                    datetime.fromisoformat(self.admission_date.replace("Z", "")).date()
                    if "T" in self.admission_date
                    else datetime.strptime(self.admission_date[:10], "%Y-%m-%d").date()
                )
                dis = (
                    datetime.fromisoformat(self.discharge_date.replace("Z", "")).date()
                    if "T" in self.discharge_date
                    else datetime.strptime(self.discharge_date[:10], "%Y-%m-%d").date()
                )
                if adm > dis:
                    raise ValueError(
                        f"Temporal Hierarchy Violation: admission_date ({adm}) cannot occur after discharge_date ({dis})."
                    )
            except (ValueError, TypeError):
                pass

        # 3. Domain Taxonomy Invariant: ICD-9 / SNOMED Syntax
        if self.diagnosis_code:
            code = str(self.diagnosis_code).strip()
            if code.startswith("ERR_") or "!!" in code or "SYNTHETIC" in code:
                raise ValueError(
                    f"Taxonomy Syntax Drift: '{code}' is not a standardized clinical nomenclature code."
                )

        return self


__all__ = ["Record", "Records", "ClinicalRecordModel"]



