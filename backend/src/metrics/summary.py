# backend/src/metrics/summary.py
from typing import Dict, Any
from sqlmodel import Session

from src.metrics.baseline import compute_baseline_metrics
from src.metrics.agent_metrics import compute_agent_metrics
from src.metrics.risk import compute_risk_metrics
from src.metrics.forecast import compute_forecast
from src.metrics.reasoning import compute_reasoning


def compute_full_summary(dataset_id: int, session: Session) -> Dict[str, Any]:
    baseline = compute_baseline_metrics(dataset_id, session)
    agent = compute_agent_metrics(dataset_id, session)
    risk = compute_risk_metrics(dataset_id, session)
    forecast = compute_forecast(dataset_id, session)
    reasoning = compute_reasoning(dataset_id, session)

    return {
        "baseline": baseline,
        "agent": agent,
        "risk": risk,
        "forecast": forecast,
        "reasoning": reasoning,
        "summary": {
            "quality_score": baseline["quality_score"],
            "risk_score": risk["risk_score"],
            "latest_cleaner_quality": agent.get("agent_metrics", {})
                .get("cleaner", {})
                .get("metrics", {})
                .get("cleaned_quality", None)
        }
    }
