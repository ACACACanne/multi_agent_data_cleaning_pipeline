#backend/src/routes/upload.py
"""
Upload Route Controller
Handles dataset ingestion (CSV & JSON), schema detection, and dataset registry.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import Dict, Any, Optional
import io
import csv
import json
import uuid
import datetime
import logging

from src.routes.datasets import DATASETS_STORE

router = APIRouter()
logger = logging.getLogger("datara.routes.upload")

def format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{(size_bytes / 1024):.1f} KB"
    return f"{(size_bytes / (1024 * 1024)):.1f} MB"

@router.post("", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any], include_in_schema=False)
@router.post("/upload", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any], include_in_schema=False)
@router.post("/file", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any], include_in_schema=False)
async def upload_dataset_file(
    file: UploadFile = File(..., description="CSV or JSON dataset file"),
    dataset_name: Optional[str] = Form(None),
):
    """
    Accepts CSV or JSON file uploads, parses row/column dimensions, and registers the dataset.
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
        rows_count = 0
        columns_count = 0

        # Parse CSV
        if ext == "csv":
            text_content = contents.decode("utf-8", errors="replace")
            csv_reader = csv.reader(io.StringIO(text_content))
            header = next(csv_reader, None)
            if header:
                columns_count = len(header)
                rows_count = sum(1 for _ in csv_reader)
            else:
                columns_count = 0
                rows_count = 0

        # Parse JSON
        elif ext == "json":
            json_data = json.loads(contents.decode("utf-8", errors="replace"))
            if isinstance(json_data, list):
                rows_count = len(json_data)
                columns_count = len(json_data[0].keys()) if rows_count > 0 and isinstance(json_data[0], dict) else 0
            elif isinstance(json_data, dict):
                # Handle wrapped JSON like {"rows": [...]} or {"data": [...]}
                records = json_data.get("rows") or json_data.get("data") or json_data.get("records") or [json_data]
                rows_count = len(records)
                columns_count = len(records[0].keys()) if rows_count > 0 and isinstance(records[0], dict) else len(json_data.keys())

        dataset_id = f"ds_{uuid.uuid4().hex[:6]}"
        display_name = dataset_name or filename

        new_dataset = {
            "id": dataset_id,
            "name": display_name,
            "filename": filename,
            "rows_count": rows_count,
            "columns_count": columns_count,
            "file_size": format_file_size(file_size_bytes),
            "uploaded_at": datetime.datetime.utcnow().isoformat() + "Z",
            "status": "READY",
            "flags": {
                "is_gold_standard": False,
                "anonymized": True,
                "auto_clean_enabled": True,
                "requires_human_review": False,
            },
        }

        # Add to shared dataset store
        DATASETS_STORE.insert(0, new_dataset)
        logger.info(f"Dataset successfully uploaded: {display_name} ({dataset_id}) with {rows_count} rows.")

        return new_dataset

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file format.")
    except Exception as err:
        logger.error(f"Error processing upload: {str(err)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process file upload: {str(err)}")


