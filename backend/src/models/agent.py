# backend/src/models/agent.py
from __future__ import annotations
from typing import Optional, Dict, Any
from datetime import datetime

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON


class AgentRun(SQLModel, table=True):  # type: ignore
    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: int = Field(index=True)

    agent_name: str = Field(index=True)  # e.g., "auditor", "validator", "remediator", "cleaner"
    status: str = Field(default="pending")  # e.g., "pending", "running", "completed", "failed"

    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None

    # Metrics produced by this agent run
    metrics: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    # Path to detailed log file (JSON in storage/)
    log_path: Optional[str] = None

