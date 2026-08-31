"""
DataRA Pro - Agent Data Models & Database Schemas
Defines SQLModel database tables and Pydantic representations for multi-agent execution states,
audit findings, remediation actions, and validation reports.
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, ClassVar, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


# ===========================================================================
# 1. SQLMODEL DATABASE PERSISTENCE MODELS
# ===========================================================================
class AgentRun(SQLModel, table=True):
    """Database record for tracking agent executions, durations, and metrics."""

    __tablename__: ClassVar[str] = "agent_runs"

    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: int = Field(index=True)
    agent_name: str = Field(default="Auditor Agent", index=True)
    status: str = Field(default="COMPLETED")

    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = Field(default=None)
    log_path: Optional[str] = Field(default=None)

    metrics: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )
    payload: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# 2. IN-MEMORY MULTI-AGENT STATE & TELEMETRY MODELS
# ===========================================================================
class AuditFinding(BaseModel):
    """Diagnostic issue flagged by the Auditor Agent."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    row_index: int
    record_id: str
    column: str
    issue_type: str
    current_value: Optional[Any] = None
    message: str
    severity: str = "MEDIUM"


class RemediationAction(BaseModel):
    """Specific correction or transformation performed by the Remediator Agent."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    step: int
    agent: str = "Remediator Agent"
    action: str
    target_column: str
    row_index: int
    before_value: Optional[Any] = None
    after_value: Optional[Any] = None
    finding: Optional[str] = None
    timestamp: Optional[str] = None


class ValidationReport(BaseModel):
    """Verification outcome produced by the Validator Agent."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    is_valid: bool
    total_records: int
    valid_records: int
    rejected_records: int
    rejection_rate: float
    violations: List[Dict[str, Any]] = Field(default_factory=list)
    error_summary: Dict[str, int] = Field(default_factory=dict)


class GraphAgentState(BaseModel):
    """LangGraph reflection loop state passed between agents."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    dataset_id: str = "all"
    records: List[Dict[str, Any]] = Field(default_factory=list)
    findings: List[AuditFinding] = Field(default_factory=list)
    actions: List[RemediationAction] = Field(default_factory=list)
    validation: Optional[ValidationReport] = None
    iteration: int = 0

