# backend/src/routes/schema.py

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from src.db.session import get_session
from src.models.schema import SchemaDriftReport
from src.models.dataset import Dataset

router = APIRouter(tags=["schema"], prefix="/schema")


# -----------------------------
# Helpers
# -----------------------------
def _get_dataset_or_404(dataset_id: int, session: Session) -> Dataset:
    dataset = session.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


def _get_or_create_report(dataset_id: int, session: Session) -> SchemaDriftReport:
    report = session.exec(
        select(SchemaDriftReport).where(SchemaDriftReport.dataset_id == dataset_id)
    ).first()

    if report:
        return report

    _get_dataset_or_404(dataset_id, session)

    report = SchemaDriftReport(dataset_id=dataset_id)
    session.add(report)
    session.commit()
    session.refresh(report)
    return report


# -----------------------------
# GET /schema/drift?datasetId=
# Frontend calls this
# -----------------------------
@router.get("/drift")
def get_schema_drift_query(
    datasetId: Optional[int] = Query(None),
    session: Session = Depends(get_session),
):
    if datasetId is None:
        raise HTTPException(status_code=400, detail="datasetId required")

    report = _get_or_create_report(datasetId, session)

    return {
        "datasetId": datasetId,
        "summary": report.summary,
        "metrics": report.metrics,
        "fields": report.fields,
        "created_at": report.created_at,
    }


# -----------------------------
# GET /schema/drift/{dataset_id}
# Legacy endpoint
# -----------------------------
@router.get("/drift/{dataset_id}")
def get_schema_drift(dataset_id: int, session: Session = Depends(get_session)):
    report = _get_or_create_report(dataset_id, session)
    return report


# -----------------------------
# POST /schema/drift/{dataset_id}
# Update drift report
# -----------------------------
@router.post("/drift/{dataset_id}")
def set_schema_drift(
    dataset_id: int,
    payload: Dict[str, Any],
    session: Session = Depends(get_session),
):
    report = _get_or_create_report(dataset_id, session)

    report.summary = payload.get("summary", {})
    report.metrics = payload.get("metrics", {})
    report.fields = payload.get("fields", {})

    session.add(report)
    session.commit()
    session.refresh(report)

    return {
        "datasetId": dataset_id,
        "summary": report.summary,
        "metrics": report.metrics,
        "fields": report.fields,
        "updated": True,
    }

