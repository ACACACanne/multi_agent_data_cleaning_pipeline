# backend/src/models/synthetic.py
from __future__ import annotations
from typing import Optional, Dict, Any
from datetime import datetime

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON


class SyntheticErrorConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: int = Field(index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Full synthetic error configuration (types, rates, fields, etc.)
    config: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

