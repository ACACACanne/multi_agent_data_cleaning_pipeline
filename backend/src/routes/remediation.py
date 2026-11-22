# backend/src/routes/remediation.py
from typing import Optional
from fastapi import APIRouter, Query
from src.storage.remediation_history import get_history

router = APIRouter()


@router.get("")
@router.get("/")
def list_remediation_history(dataset_id: Optional[str] = Query(None)):
    history = get_history()
    if dataset_id and str(dataset_id).strip().lower() not in ["all", ""]:
        target = str(dataset_id).strip()
        history = [
            item
            for item in history
            if str(item.get("dataset_id", "")) == target
        ]
    return list(reversed(history))