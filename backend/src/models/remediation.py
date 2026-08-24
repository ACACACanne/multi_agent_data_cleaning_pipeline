# backend/src/models/remediation.py
from __future__ import annotations
from typing import Optional, Dict, Any
from datetime import datetime

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON


class RemediationEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: int = Field(index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Short description of the remediation action
    action: str

    # Detailed payload (rows affected, rules applied, etc.)
    details: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    # Which agent or user performed this remediation
    actor: Optional[str] = None  # e.g., "cleaner", "manual_user", etc.

