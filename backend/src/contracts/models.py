# src/contracts/models.py
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class DataIssue(BaseModel):
    """
    Represents a single data quality issue detected in a dataset.
    """
    id: str = Field(default_factory=lambda: str(uuid4()), description="Unique identifier for the issue")
    column: str = Field(..., description="Column name where the issue was detected")
    issue_type: str = Field(..., description="Short machine-friendly issue type")
    description: str = Field(..., description="Human-readable description of the issue")
    severity: Literal["High", "Medium", "Low"] = Field(..., description="Severity level")
    row_sample: Optional[List[str]] = Field(None, description="Optional sample rows illustrating the issue")
    detected_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp when the issue was detected")


class AuditReport(BaseModel):
    """
    Audit report summarizing detected issues and overall quality for a dataset.
    """
    id: str = Field(default_factory=lambda: str(uuid4()), description="Unique identifier for the audit report")
    dataset_name: Optional[str] = Field(default=None, description="Name or path of the dataset audited")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Report creation timestamp")
    issues: List[DataIssue] = Field(default_factory=list, description="List of detected data issues")
    quality_score: float = Field(..., description="Overall quality score (0-100)", ge=0.0, le=100.0)
    summary: Optional[str] = Field(None, description="Short human-readable summary of the audit results")
    metadata: Optional[dict] = Field(None, description="Optional additional metadata (e.g., row_count, columns, runtime_ms)")

    class Config:
        schema_extra = {
            "example": {
                "id": "b3f9a2d4-1c2b-4f6a-9a2d-0f1e2d3c4b5a",
                "dataset_name": "customers.csv",
                "created_at": "2026-08-06T06:31:00Z",
                "quality_score": 92.5,
                "summary": "Mostly clean dataset with a few missing values in age and email columns.",
                "issues": [
                    {
                        "id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
                        "column": "age",
                        "issue_type": "missing_value",
                        "description": "Missing values in 12% of rows",
                        "severity": "Medium",
                        "row_sample": ["", "34", "27"],
                        "detected_at": "2026-08-06T06:30:00Z"
                    }
                ],
                "metadata": {"row_count": 12000, "columns": 12, "runtime_ms": 234}
            }
        }


