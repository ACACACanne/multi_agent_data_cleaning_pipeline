# backend/src/models/experiment.py
from __future__ import annotations
from typing import Optional, Dict, Any, TYPE_CHECKING
from datetime import datetime

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

if TYPE_CHECKING:
    from src.models.dataset import Dataset


# -------------------------------------------------------------
# 1. SQLMODEL DATABASE TABLE
# -------------------------------------------------------------
class Experiment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: Optional[str] = Field(default="all", index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    name: str = Field(index=True)  # e.g., "multiagent_cleaning_v2"

    # Experiment configuration (agents, thresholds, etc.)
    config: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    # Experiment results (metrics, comparisons, etc.)
    results: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    dataset: Optional["Dataset"] = Relationship(back_populates="experiments")


# -------------------------------------------------------------
# 2. PYDANTIC / SQLMODEL SCHEMAS FOR API ROUTES
# -------------------------------------------------------------
class ExperimentCreate(SQLModel):
    name: str
    dataset_id: Optional[str] = "all"
    config: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None
    experiment_type: Optional[str] = "AUTONOMOUS_REMEDIATION_EVAL"


class ExperimentRead(SQLModel):
    id: Optional[int] = None
    dataset_id: Optional[str] = "all"
    created_at: datetime
    name: str
    config: Dict[str, Any] = {}
    results: Dict[str, Any] = {}

