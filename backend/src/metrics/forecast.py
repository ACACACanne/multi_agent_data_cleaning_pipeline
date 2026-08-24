# backend/src/metrics/forecast.py
from typing import Dict, Any, List
from sqlmodel import Session

from src.storage.trajectories import get_trajectories


def compute_forecast(dataset_id: int, session: Session) -> Dict[str, Any]:
    trajectories = get_trajectories(dataset_id)
    agent_traj = trajectories.get("agent", [])

    if not agent_traj:
        return {
            "forecast": [],
            "reasoning": "No agent trajectory available for forecasting."
        }

    # Expect agent trajectory entries to include a cleaner quality metric
    last_quality = None
    for entry in reversed(agent_traj):
        if isinstance(entry, dict) and "cleaned_quality" in entry:
            last_quality = entry.get("cleaned_quality")
            break
    if last_quality is None:
        last_quality = 0.8

    forecast: List[Dict[str, Any]] = []
    for i in range(1, 6):
        forecast.append({
            "step": i,
            "predicted_quality": round(min(1.0, last_quality + i * 0.02), 4)
        })

    return {
        "forecast": forecast,
        "reasoning": "Forecast generated using linear projection."
    }

