#backend/src/models/schema.py
"""
DataRA Pro - Schema Drift & Drift Assertion Models
Defines SQLModel representations for dataset schema variations and structural changes.
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, ClassVar, Dict, Optional
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class SchemaDriftReport(SQLModel, table=True):
    __tablename__: ClassVar[str] = "schema_drift_reports"

    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: int = Field(index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # High-level summary of drift
    summary: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    # Metrics about drift (severity, affected fields, etc.)
    metrics: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    # Per-field drift details
    fields: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )


# Compatibility aliases
SchemaDrift = SchemaDriftReport