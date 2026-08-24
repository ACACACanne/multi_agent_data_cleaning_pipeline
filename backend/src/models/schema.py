# backend/src/models/schema.py
from __future__ import annotations
from typing import Optional, Dict, Any
from datetime import datetime

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON


class SchemaDriftReport(SQLModel, table=True):
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

