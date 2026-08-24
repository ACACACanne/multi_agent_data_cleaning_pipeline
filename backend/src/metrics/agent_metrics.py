# backend/src/metrics/agent_metrics.py
from typing import Dict, Any
from sqlmodel import Session, select

from src.models.agent import AgentRun


def compute_agent_metrics(dataset_id: int, session: Session) -> Dict[str, Any]:
    runs = session.exec(
        select(AgentRun).where(AgentRun.dataset_id == dataset_id)
    ).all()

    summary = {}

    for run in runs:
        summary[run.agent_name] = {
            "status": run.status,
            "metrics": run.metrics,
            "started_at": run.started_at,
            "finished_at": run.finished_at,
            "log_path": run.log_path,
        }

    return {
        "agent_metrics": summary,
        "reasoning": f"Collected metrics from {len(runs)} agent runs."
    }
