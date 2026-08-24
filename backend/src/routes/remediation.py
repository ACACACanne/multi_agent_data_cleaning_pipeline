# backend/src/routes/remediation.py

"""
Remediation Route Controller
Tracks automated repairs, human-in-the-loop review actions, and suggestions.
"""

from fastapi import APIRouter, Body, Path, Query
from typing import Dict, Any, List, Optional
import datetime

router = APIRouter()

REMEDIATION_HISTORY = [
    {
        "id": "rem_001",
        "dataset_id": "ds_001",
        "column": "admission_date",
        "issue_type": "MISSING_VALUE",
        "proposed_fix": "Contextual KNN Imputation (Date Sequence)",
        "confidence": 0.96,
        "status": "APPLIED",
        "timestamp": "2026-08-20T14:15:00Z"
    },
    {
        "id": "rem_002",
        "dataset_id": "ds_001",
        "column": "systolic_bp",
        "issue_type": "OUTLIER",
        "proposed_fix": "Capped to 99th percentile boundary (210)",
        "confidence": 0.92,
        "status": "PENDING_REVIEW",
        "timestamp": "2026-08-20T14:15:05Z"
    },
    {
        "id": "rem_003",
        "dataset_id": "ds_001",
        "column": "diagnosis_code",
        "issue_type": "SYNTAX_DRIFT",
        "proposed_fix": "Normalized to ICD-10 standard format",
        "confidence": 0.99,
        "status": "APPLIED",
        "timestamp": "2026-08-20T14:15:10Z"
    }
]

@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]], include_in_schema=False)
async def list_remediations(dataset_id: Optional[str] = Query(None)):
    if dataset_id:
        return [r for r in REMEDIATION_HISTORY if str(r["dataset_id"]) == str(dataset_id)]
    return REMEDIATION_HISTORY

@router.get("/suggestions", response_model=List[Dict[str, Any]])
async def get_fix_suggestions(dataset_id: Optional[str] = Query(None)):
    return [
        {
            "id": "sug_01",
            "column": "patient_address",
            "type": "PII_REDACTION",
            "recommendation": "Scrub ZIP+4 and street address using Presidio PII sanitizer.",
            "impact": "HIGH",
            "confidence": 0.98
        },
        {
            "id": "sug_02",
            "column": "discharge_date",
            "type": "CHRONOLOGY_CHECK",
            "recommendation": "Assert discharge_date >= admission_date across 14,250 rows.",
            "impact": "CRITICAL",
            "confidence": 0.99
        }
    ]

@router.post("/{remediation_id}/apply", response_model=Dict[str, Any])
async def apply_remediation(remediation_id: str = Path(...), payload: Optional[Dict[str, Any]] = Body(default={})):
    for r in REMEDIATION_HISTORY:
        if str(r["id"]) == str(remediation_id):
            r["status"] = payload.get("action", "APPLIED") if payload else "APPLIED"
            return {"id": remediation_id, "status": r["status"], "updated_at": datetime.datetime.utcnow().isoformat() + "Z"}
    return {"id": remediation_id, "status": "APPLIED"}