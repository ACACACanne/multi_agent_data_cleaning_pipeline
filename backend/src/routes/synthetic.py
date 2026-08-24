"""
Synthetic Error Route Controller
Generates and persists a new synthetic corrupted dataset into DATASETS_STORE.
"""

from fastapi import APIRouter, Body, Query, HTTPException, status
from typing import Dict, Any, List, Optional
import datetime
import uuid
import random
import logging

from src.routes.datasets import (DATASETS_STORE, DATASET_SAMPLES_STORE, save_persisted_storage,)

router = APIRouter()
logger = logging.getLogger("datara.routes.synthetic")

@router.get("", response_model=Dict[str, Any])
@router.get("/", response_model=Dict[str, Any], include_in_schema=False)
async def get_synthetic_overview():
    return {
        "status": "ready",
        "supported_error_types": [
            "missing_values",
            "outliers",
            "type_corruption",
            "schema_drift",
            "syntax_formatting"
        ],
        "default_injection_rate": 0.05
    }

@router.post("/generate", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
@router.post("/inject", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def generate_synthetic_errors(payload: Dict[str, Any] = Body(...)):
    """
    Creates a new synthetic dirty dataset with injected corruptions and adds it to DATASETS_STORE.
    """
    dataset_id = str(payload.get("dataset_id") or payload.get("datasetId") or "ds_001")
    pct_raw = payload.get("error_rate") or payload.get("pct") or payload.get("percentage") or 5
    
    try:
        pct_numeric = float(pct_raw)
        if pct_numeric > 1.0 and pct_numeric <= 100.0:
            pct_numeric = pct_numeric / 100.0
    except (ValueError, TypeError):
        pct_numeric = 0.05

    pct_display = int(round(pct_numeric * 100))

    # 1. Find the source dataset
    source_ds = next((ds for ds in DATASETS_STORE if str(ds["id"]) == dataset_id), None)
    source_name = source_ds["name"] if source_ds else f"Dataset_{dataset_id}.csv"
    base_rows_count = source_ds.get("rows_count", 299) if source_ds else 299

    # 2. Get base rows or create templates
    base_rows = DATASET_SAMPLES_STORE.get(dataset_id)
    if not base_rows:
        base_rows = DATASET_SAMPLES_STORE.get("ds_001", [])

    # 3. Generate corrupted sample rows
    new_dataset_id = f"ds_syn_{uuid.uuid4().hex[:6]}"
    corrupted_rows = []
    anomaly_types = ["OUTLIER_BP", "NULL_DATE", "SYNTAX_DRIFT", "NEGATIVE_VALUE"]

    for idx, row in enumerate(base_rows):
        mutated = dict(row)
        mutated["id"] = f"rec_{new_dataset_id}_{idx + 1}"
        
        if idx % 2 == 0 or pct_numeric >= 0.1:
            chosen = anomaly_types[idx % len(anomaly_types)]
            if chosen == "OUTLIER_BP":
                mutated["systolic_bp"] = random.choice([295, 310, 345])
                mutated["diastolic_bp"] = random.choice([160, 185])
                mutated["data_status"] = "SYNTHETIC_ANOMALY"
            elif chosen == "NULL_DATE":
                mutated["admission_date"] = None
                mutated["data_status"] = "SYNTHETIC_ANOMALY"
            elif chosen == "SYNTAX_DRIFT":
                mutated["diagnosis_code"] = f"ERR_ICD_{random.randint(100, 999)}!!"
                mutated["data_status"] = "SYNTHETIC_ANOMALY"
            elif chosen == "NEGATIVE_VALUE":
                mutated["diastolic_bp"] = -20
                mutated["data_status"] = "SYNTHETIC_ANOMALY"
                
        corrupted_rows.append(mutated)

    # Insert a guaranteed high-visibility anomaly row at index 0
    corrupted_rows.insert(0, {
        "id": f"rec_{new_dataset_id}_000",
        "patient_id": f"PT-SYN-{random.randint(1000, 9999)}",
        "admission_date": None,
        "discharge_date": "2026-08-01",
        "systolic_bp": 330,
        "diastolic_bp": 195,
        "diagnosis_code": "SYNTHETIC_CORRUPT_X99",
        "data_status": "SYNTHETIC_ANOMALY"
    })

    # 4. Save rows to stateful store
    DATASET_SAMPLES_STORE[new_dataset_id] = corrupted_rows

    injected_count = max(10, int(base_rows_count * pct_numeric))
    clean_name = source_name.replace("[Synthetic ", "").replace("]", "")

    # 5. Create new dataset metadata and prepend to DATASETS_STORE
    clean_name = source_name.replace("[Synthetic ", "").replace("]", "")
    new_dataset_entry = {
        "id": new_dataset_id,
        "name": f"[Synthetic {pct_display}%] {clean_name}",
        "rows_count": base_rows_count,
        "columns_count": source_ds.get("columns_count", 8) if source_ds else 8,
        "file_size": source_ds.get("file_size", "1.5 MB") if source_ds else "1.5 MB",
        "uploaded_at": datetime.datetime.utcnow().isoformat() + "Z",
        "status": "NEEDS_REMEDIATION",
        "synthetic_injected": True,
        "source_dataset_id": dataset_id,
        "error_rate": pct_numeric,
        "anomalies_count": injected_count,
        "flags": {
            "is_gold_standard": False,
            "anonymized": True,
            "auto_clean_enabled": True,
            "requires_human_review": True,
        }
    }

    DATASETS_STORE.insert(0, new_dataset_entry)

    # 6. PERMANENTLY SAVE TO DISK
    save_persisted_storage()

    logger.info(
        f"Persisted synthetic dataset: {new_dataset_entry['name']} ({new_dataset_id})"
    )
   

    return {
        "status": "SUCCESS",
        "dataset": new_dataset_entry,
        "new_dataset_id": new_dataset_id,
        "dataset_id": new_dataset_id,
        "source_dataset_id": dataset_id,
        "percentage": pct_display,
        "injected_anomalies_count": injected_count,
        "sample_rows_corrupted": len(corrupted_rows),
        "message": f"Successfully created synthetic dataset '{new_dataset_entry['name']}'."
    }

