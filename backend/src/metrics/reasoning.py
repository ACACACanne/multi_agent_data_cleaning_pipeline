# backend/src/metrics/reasoning.py
from typing import Dict, Any, List
from sqlmodel import Session

from src.storage.reasoning import get_reasoning


def compute_reasoning(dataset_id: int, session: Session) -> Dict[str, Any]:
    timeline: List[Dict[str, Any]] = get_reasoning(dataset_id)
    return {
        "timeline": timeline,
        "reasoning": f"Collected {len(timeline)} reasoning entries."
    }

