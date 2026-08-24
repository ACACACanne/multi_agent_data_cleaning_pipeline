# backend/src/metrics/risk.py
from typing import Dict, Any
from sqlmodel import Session, select

from src.models.record import Record


def compute_risk_metrics(dataset_id: int, session: Session) -> Dict[str, Any]:
    records = session.exec(
        select(Record).where(Record.dataset_id == dataset_id)
    ).all()

    total_records = len(records)
    total_fields = 0
    risky = 0

    for r in records:
        row_data = r.data or {}
        total_fields += len(row_data)
        for v in row_data.values():
            if v in ("N/A", None, ""):
                risky += 1

    risk_score = risky / max(total_fields, 1)

    return {
        "risk_score": round(risk_score, 4),
        "risky_fields": risky,
        "total_fields": total_fields,
        "total_records": total_records,
        "reasoning": f"Risk score computed from {total_records} records with {risky} risky fields."
    }

