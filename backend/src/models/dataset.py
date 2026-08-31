# backend/src/models/dataset.py
"""
DataRA Pro - Dataset SQLModel & Metadata Schema
Defines dataset persistence entity and relationships to metrics, evaluations, and experiments.
"""

from __future__ import annotations
from typing import TYPE_CHECKING, Any, ClassVar, Dict, List, Optional
from sqlalchemy import Column, Integer, JSON, Text
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from src.models.cleaner import CleanerMetrics
    from src.models.evaluation import Evaluation
    from src.models.experiment import Experiment
    from src.models.metrics import Metrics


class Dataset(SQLModel, table=True):
    __tablename__: ClassVar[str] = "datasets"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, sa_column=Column("name", Text, nullable=True))
    description: Optional[str] = Field(default=None, sa_column=Column("description", Text, nullable=True))

    # Use `meta` in Python but persist to DB column "metadata"
    meta: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column("metadata", JSON, nullable=True),
    )

    quality_score: Optional[float] = Field(default=None, sa_column=Column("quality_score", nullable=True))
    hidden: Optional[int] = Field(default=0, sa_column=Column("hidden", Integer, nullable=False))

    # Relationships (names must match back_populates on related models)
    cleaner_metrics: Optional["CleanerMetrics"] = Relationship(back_populates="dataset")
    metrics: Optional["Metrics"] = Relationship(back_populates="dataset")
    evaluations: List["Evaluation"] = Relationship(back_populates="dataset")
    experiments: List["Experiment"] = Relationship(back_populates="dataset")

    def __repr__(self) -> str:
        return f"<Dataset id={self.id} name={self.name!r}>"

    def load_records(self, session, limit: int = 100):
        from src.models.record import Record
        return session.query(Record).filter(Record.dataset_id == self.id).limit(limit).all()


# Compatibility alias
Datasets = Dataset