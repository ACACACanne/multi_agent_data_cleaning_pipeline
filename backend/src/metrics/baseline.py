# backend/src/metrics/baseline.py
from typing import Dict, Any
from sqlmodel import Session, select

from src.models.record import Record


def compute_baseline_metrics(dataset_id: int, session: Session) -> Dict[str, Any]:
    records = session.exec(
        select(Record).where(Record.dataset_id == dataset_id)
    ).all()

    total_records = len(records)
    total_fields = 0
    missing_count = 0

    for r in records:
        row_data = r.data or {}
        total_fields += len(row_data)
        for v in row_data.values():
            if v is None or v == "":
                missing_count += 1

    quality_score = 1.0 - (missing_count / max(total_fields, 1))

    issues = {
        "missing_values": missing_count,
        "total_fields": total_fields,
        "total_records": total_records,
    }

    return {
        "quality_score": round(quality_score, 4),
        "issues": issues,
        "reasoning": f"Baseline computed using {total_records} records with {missing_count} missing values."
    }


