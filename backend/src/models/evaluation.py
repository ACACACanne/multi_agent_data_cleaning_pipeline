# backend/src/models/evaluation.py
from __future__ import annotations
from typing import Optional, Dict, Any
from datetime import datetime

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

from src.models.dataset import Dataset


class Evaluation(SQLModel, table=True):  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: int = Field(foreign_key="dataset.id", index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    name: str = Field(index=True)  # e.g., "baseline_vs_agents_v1"

    # Evaluation metrics (precision, recall, F1, etc.)
    metrics: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    dataset: Optional[Dataset] = Relationship(back_populates="evaluations")

