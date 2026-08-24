"""
Cleaner Agent (Dynamic Quality Finalization & Persistence)
Evaluates finalized dataset records against adaptive domain contracts,
persists verified scores to CleanerMetrics, and synthesizes actionable recommendations.
"""

from typing import Dict, Any, List
import logging
import json
from sqlmodel import Session, select
from pydantic import ValidationError

from src.models.record import Record
from src.models.cleaner import CleanerMetrics
from src.agents.validator import AdaptiveClinicalContract

logger = logging.getLogger(__name__)


def run_cleaner(dataset_id: Any, session: Session) -> Dict[str, Any]:
    """
    Cleaner Agent: Evaluates finalized dataset records against adaptive domain contracts,
    computes verified quality scores, and persists verified metrics to the database.
    """
    target_id_str = str(dataset_id).strip()

    if target_id_str.isdigit():
        records = session.exec(
            select(Record).where(Record.dataset_id == int(target_id_str))
        ).all()
    else:
        records = session.exec(
            select(Record).where(str(Record.dataset_id) == target_id_str)
        ).all()

    total_records = len(records)
    if total_records == 0:
        return {
            "agent": "cleaner",
            "cleaned_quality": 1.0,
            "passed_count": 0,
            "total_records": 0,
            "issues": {"remaining": 0},
            "suggestions": ["Dataset is empty or already finalized."],
            "reasoning": f"Cleaner evaluated 0 records for dataset '{dataset_id}'."
        }

    passed_count = 0
    unresolved_issues: List[Dict[str, Any]] = []
    issue_type_counts: Dict[str, int] = {}

    for r in records:
        data_dict: Dict[str, Any] = dict(r.data) if isinstance(r.data, dict) else {}
        try:
            AdaptiveClinicalContract(**data_dict)
            passed_count += 1
        except ValidationError as val_err:
            errors = [f"{e['loc'][0] if e['loc'] else 'contract'}: {e['msg']}" for e in val_err.errors()]
            unresolved_issues.append({"record_id": r.id, "errors": errors})
            for err_msg in errors:
                key = err_msg.split(":")[0].strip()
                issue_type_counts[key] = issue_type_counts.get(key, 0) + 1
        except Exception as generic_err:
            unresolved_issues.append({"record_id": r.id, "errors": [str(generic_err)]})
            issue_type_counts["general_fault"] = issue_type_counts.get("general_fault", 0) + 1

    cleaned_quality = round(float(passed_count / total_records), 4)
    remaining_count = len(unresolved_issues)

    # Dynamic suggestions synthesis
    suggestions: List[Dict[str, Any]] = []
    if remaining_count == 0:
        suggestions.append({
            "id": f"sug_{dataset_id}_1",
            "column": "All Columns",
            "field": "Schema & Invariants",
            "action": "Contract Certification",
            "recommendation": "All records comply with domain contracts (100% certified). Ready for ML ingestion.",
            "confidence": 1.0,
            "impact": "Certified Valid"
        })
    else:
        for field, count in issue_type_counts.items():
            suggestions.append({
                "id": f"sug_{dataset_id}_{field}",
                "column": field,
                "field": "Data Quality Exception",
                "action": "Remediation Follow-up",
                "recommendation": f"Review {count} record(s) flagged with '{field}' invariant violations.",
                "confidence": 0.95,
                "impact": f"+{(count / total_records * 100):.1f}% Accuracy"
            })

    # Persist CleanerMetrics into Database
    try:
        ds_int = int(target_id_str) if target_id_str.isdigit() else 1
        metrics = session.get(CleanerMetrics, ds_int)
        if not metrics:
            metrics = CleanerMetrics(dataset_id=ds_int)
        metrics.cleaned_quality = cleaned_quality
        metrics.issues = {
            "remaining": remaining_count,
            "passed": passed_count,
            "total": total_records
        }
        session.add(metrics)
        session.commit()
    except Exception as exc:
        logger.debug("CleanerMetrics commit notice: %s", exc)

    return {
        "agent": "cleaner",
        "cleaned_quality": cleaned_quality,
        "passed_records": passed_count,
        "total_records": total_records,
        "issues": {"remaining": remaining_count},
        "suggestions": suggestions,
        "reasoning": f"Cleaner verified {passed_count}/{total_records} records ({cleaned_quality * 100:.1f}% certified quality score) with {remaining_count} remaining edge exceptions."
    }
