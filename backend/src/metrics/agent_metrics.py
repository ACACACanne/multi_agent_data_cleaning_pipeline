#backend/src/metrics/agent_metrics.py
"""
DataRA Pro - Agent Metrics Computation
Extracts and summarizes historical agent telemetry runs from SQLModel sessions.
"""

from __future__ import annotations
from typing import Any, Dict, Union
from sqlmodel import Session, select

from src.models.agent import AgentRun


def compute_agent_metrics(dataset_id: Union[int, str], session: Session) -> Dict[str, Any]:
    """Retrieves all agent execution runs for a given dataset and builds a summary dictionary."""
    try:
        target_id = int(dataset_id)
    except (ValueError, TypeError):
        target_id = 1

    try:
        runs = session.exec(
            select(AgentRun).where(AgentRun.dataset_id == target_id)
        ).all()
    except Exception:
        runs = []

    summary: Dict[str, Any] = {}

    for run in runs:
        summary[run.agent_name] = {
            "status": run.status,
            "metrics": run.metrics or {},
            "payload": run.payload or {},
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            "log_path": run.log_path,
        }

    return {
        "dataset_id": target_id,
        "agent_metrics": summary,
        "total_runs": len(runs),
        "reasoning": f"Collected metrics from {len(runs)} agent runs.",
    }