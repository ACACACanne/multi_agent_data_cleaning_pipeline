"""
DataRA Pro - Validator Agent
Evaluates dataset compliance against deterministic Pydantic invariant contracts.
"""

from typing import List, Dict, Any
from src.models.schemas import ClinicalRecordModel, ValidationReport


class ValidatorAgent:
    """Gatekeeper agent validating records against clinical rules and computing rejection rates."""

    def __init__(self, name: str = "Validator Agent"):
        self.name = name

    def validate_records(self, records: List[Dict[str, Any]]) -> ValidationReport:
        if not records:
            return ValidationReport(
                is_valid=True,
                total_records=0,
                valid_records=0,
                rejected_records=0,
                rejection_rate=0.0,
                violations=[],
                error_summary={}
            )

        total_records = len(records)
        rejected_records = 0
        violations = []
        error_summary: Dict[str, int] = {}

        for idx, rec in enumerate(records):
            clean_rec = {k: v for k, v in rec.items() if not str(k).startswith("_")}
            try:
                ClinicalRecordModel(**clean_rec)
            except Exception as e:
                rejected_records += 1
                err_str = str(e)
                err_type = "SCHEMA_ERROR"
                if "Hemodynamic" in err_str:
                    err_type = "HEMODYNAMIC_TREE_VIOLATION"
                elif "Temporal" in err_str:
                    err_type = "TEMPORAL_TREE_VIOLATION"
                elif "Taxonomy" in err_str:
                    err_type = "TAXONOMY_DRIFT"

                error_summary[err_type] = error_summary.get(err_type, 0) + 1
                violations.append({
                    "row_index": idx,
                    "record_id": rec.get("id", f"row_{idx}"),
                    "error": err_str,
                    "error_type": err_type
                })

        valid_records = total_records - rejected_records
        rejection_rate = round(rejected_records / max(1, total_records), 4)

        return ValidationReport(
            is_valid=(rejected_records == 0),
            total_records=total_records,
            valid_records=valid_records,
            rejected_records=rejected_records,
            rejection_rate=rejection_rate,
            violations=violations,
            error_summary=error_summary
        )