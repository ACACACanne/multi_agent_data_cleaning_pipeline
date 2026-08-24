# backend/src/models/cleaner.py
from __future__ import annotations
from typing import Optional, Dict, Any
from datetime import datetime

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

from src.models.dataset import Dataset


class CleanerMetrics(SQLModel, table=True):  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: int = Field(foreign_key="dataset.id", unique=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Quality after cleaner agent
    cleaned_quality: Optional[float] = Field(default=None)

    # Issues remaining / resolved
    issues: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    # Suggestions for further fixes
    suggestions: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    dataset: Optional[Dataset] = Relationship(back_populates="cleaner_metrics")

