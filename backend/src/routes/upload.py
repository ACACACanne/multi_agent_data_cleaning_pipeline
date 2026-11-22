#backend/src/routes/upload.py
"""
Upload Route Controller (Production)
Handles dataset ingestion (CSV & JSON), row parsing, dataset registry,
and database record persistence.
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from typing import Dict, Any, Optional, List
import io
import csv
import json
import uuid
import datetime
import logging

from sqlmodel import Session

from src.db.session import get_session
from src.models.record import Record
from src.routes.datasets import (
    DATASETS_STORE,
    DATASET_SAMPLES_STORE,
    save_persisted_storage,
)

router = APIRouter()
logger = logging.getLogger("datara.routes.upload")


def format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{(size_bytes / 1024):.1f} KB"
    return f"{(size_bytes / (1024 * 1024)):.1f} MB"


def _persist_records_to_db(
    session: Session, dataset_id: str, rows: List[Dict[str, Any]]
) -> None:
    """Persists parsed dataset rows into the records table when available."""
    if not rows:
        return

    try:
        for idx, row in enumerate(rows):
            record_id = f"{dataset_id}_r{idx + 1}_{uuid.uuid4().hex[:6]}"
            patient_val = (
                row.get("patient_id")
                or row.get("patient_nbr")
                or row.get("id")
            )
            db_record = Record(
                id=record_id,
                dataset_id=str(dataset_id),
                patient_id=str(patient_val) if patient_val is not None else None,
                row_data=row,
                data_status=str(row.get("data_status") or "VALID"),
            )
            session.add(db_record)
        session.commit()
    except Exception as db_err:
        session.rollback()
        logger.warning(f"Database record persistence notice for {dataset_id}: {db_err}")


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any], include_in_schema=False)
@router.post("/upload", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any], include_in_schema=False)
@router.post("/file", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any], include_in_schema=False)
async def upload_dataset_file(
    file: UploadFile = File(..., description="CSV or JSON dataset file"),
    dataset_name: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
    """
    Accepts CSV or JSON file uploads, parses rows/columns, registers the dataset,
    and persists rows to storage and database.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename = file.filename
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if ext not in ["csv", "json"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: '.{ext}'. Only CSV and JSON files are supported.",
        )

    try:
        contents = await file.read()
        file_size_bytes = len(contents)
        parsed_rows: List[Dict[str, Any]] = []
        columns_count = 0

        if ext == "csv":
            text_content = contents.decode("utf-8", errors="replace")
            dict_reader = csv.DictReader(io.StringIO(text_content))
            columns_count = len(dict_reader.fieldnames or [])
            for idx, row in enumerate(dict_reader):
                item = dict(row)
                item.setdefault("id", f"row_{idx + 1}")
                item.setdefault("data_status", "VALID")
                parsed_rows.append(item)

        elif ext == "json":
            json_data = json.loads(contents.decode("utf-8", errors="replace"))
            if isinstance(json_data, list):
                raw_records = json_data
            elif isinstance(json_data, dict):
                raw_records = (
                    json_data.get("rows")
                    or json_data.get("data")
                    or json_data.get("records")
                    or [json_data]
                )
            else:
                raw_records = []

            for idx, rec in enumerate(raw_records):
                if isinstance(rec, dict):
                    item = dict(rec)
                    item.setdefault("id", f"row_{idx + 1}")
                    item.setdefault("data_status", "VALID")
                    parsed_rows.append(item)

            if parsed_rows:
                columns_count = len(parsed_rows[0].keys())
            elif isinstance(json_data, dict):
                columns_count = len(json_data.keys())

        rows_count = len(parsed_rows)
        dataset_id = f"ds_{uuid.uuid4().hex[:6]}"
        display_name = dataset_name or filename

        new_dataset = {
            "id": dataset_id,
            "name": display_name,
            "filename": filename,
            "rows_count": rows_count,
            "rows": rows_count,
            "columns_count": columns_count,
            "file_size": format_file_size(file_size_bytes),
            "uploaded_at": datetime.datetime.utcnow().isoformat() + "Z",
            "status": "READY",
            "anomalies_count": 0,
            "anomalies": 0,
            "synthetic_injected": False,
            "flags": {
                "is_gold_standard": False,
                "anonymized": True,
                "auto_clean_enabled": True,
                "requires_human_review": False,
            },
        }

        DATASETS_STORE.insert(0, new_dataset)
        DATASET_SAMPLES_STORE[dataset_id] = parsed_rows
        save_persisted_storage()
        _persist_records_to_db(session, dataset_id, parsed_rows)

        logger.info(
            f"Dataset successfully uploaded: {display_name} ({dataset_id}) with {rows_count} rows."
        )

        return new_dataset

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file format.")
    except Exception as err:
        logger.error(f"Error processing upload: {str(err)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to process file upload: {str(err)}"
        )


