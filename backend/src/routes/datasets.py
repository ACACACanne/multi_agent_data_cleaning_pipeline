# backend/src/routes/datasets.py
# backend/src/routes/datasets.py
"""
Datasets Route Controller (Production)
Manages uploaded and registered datasets with persistent storage.
Streams downloadable exports formatted as 'synthetic_<percentage>%_<name>' or original clean names.
"""

from __future__ import annotations

import copy
import datetime
import io
import json
import logging
from pathlib import Path
import random
import re
from typing import Any, Dict, List, Optional, Tuple
import uuid

import pandas as pd
from fastapi import APIRouter, Body, HTTPException, Path as FPath, Query, status
from fastapi.responses import Response

router = APIRouter()
logger = logging.getLogger("remedira.routes.datasets")

PERSISTENCE_DIR = Path(__file__).resolve().parent.parent.parent
PERSISTENCE_FILE = PERSISTENCE_DIR / "datasets_storage.json"


# ===========================================================================
# 1. DYNAMIC NAME & ERROR RATE FORMATTING HELPERS
# ===========================================================================
def parse_error_rate(
    payload: Dict[str, Any], default: float = 0.15
) -> Tuple[float, int]:
    """Extracts and normalizes injection rates (e.g. 15, '15%', 0.15 -> (0.15, 15))."""
    config_obj = (
        payload.get("config") if isinstance(payload.get("config"), dict) else {}
    )

    for source in [payload, config_obj]:
        for key in [
            "error_rate",
            "injected_rate",
            "rate",
            "noise_level",
            "percentage",
            "pct",
            "anomalies_percentage",
            "corruption_rate",
            "ratio",
        ]:
            if key in source and source[key] is not None:
                raw_val = source[key]
                try:
                    cleaned = str(raw_val).replace("%", "").strip()
                    parsed = float(cleaned)
                    if parsed <= 0:
                        return 0.01, 1
                    elif parsed < 1.0:
                        pct_fraction = float(parsed)
                        pct_display = max(1, int(round(parsed * 100)))
                        return round(pct_fraction, 4), pct_display
                    elif parsed <= 100.0:
                        pct_display = int(round(parsed))
                        pct_fraction = round(parsed / 100.0, 4)
                        return pct_fraction, pct_display
                except (ValueError, TypeError):
                    break

    default_fraction = (
        round(default / 100.0, 4) if default > 1.0 else round(default, 4)
    )
    default_display = int(round(default_fraction * 100))
    return default_fraction, default_display


def compute_dynamic_injection_percentage(d: Dict[str, Any]) -> int:
    """Computes the exact injection percentage dynamically from metadata."""
    if d.get("injected_rate") is not None:
        try:
            return int(round(float(d["injected_rate"])))
        except (ValueError, TypeError):
            pass

    error_rate = d.get("error_rate")
    if error_rate is not None:
        try:
            rate = float(error_rate)
            return max(1, int(round(rate * 100.0 if rate <= 1.0 else rate)))
        except (ValueError, TypeError):
            pass

    rows = max(1, int(d.get("rows_count", d.get("rows", 1))))
    anomalies = int(d.get("anomalies_count", d.get("anomalies", 0)))
    if anomalies > 0:
        return max(1, int(round((anomalies / rows) * 100.0)))

    return 15


def format_dynamic_synthetic_name(d: Dict[str, Any]) -> str:
    """Formats UI dataset display name as '[Synthetic X%] Clean_Name.csv'."""
    raw_name = str(d.get("name", "dataset.csv"))
    clean_name = re.sub(
        r"\[Synthetic\s*\d*%?\]\s*", "", raw_name, flags=re.IGNORECASE
    ).strip()
    clean_name = re.sub(
        r"\s*\[Synthetic.*?\]", "", clean_name, flags=re.IGNORECASE
    ).strip()
    clean_name = re.sub(
        r"_\[injected_\d+pct.*?\]", "", clean_name, flags=re.IGNORECASE
    ).strip()

    if not clean_name:
        clean_name = f"dataset_{d.get('id', 'dataset')}.csv"

    pct = compute_dynamic_injection_percentage(d)
    return f"[Synthetic {pct}%] {clean_name}"


def format_export_filename(dataset_meta: Dict[str, Any], ext: str = "csv") -> str:
    """
    Formats the downloadable file name:
    - Synthetic: 'synthetic_<pct>%_<clean_name>.<ext>'
    - Uploaded/Dataset: '<clean_name>.<ext>'
    """
    raw_name = str(dataset_meta.get("name", "dataset.csv"))
    clean_name = re.sub(r"\[.*?\]\s*", "", raw_name, flags=re.IGNORECASE).strip()
    clean_name = re.sub(r"\.(csv|json)$", "", clean_name, flags=re.IGNORECASE).strip()
    clean_name = re.sub(
        r"_\[injected_.*?\]", "", clean_name, flags=re.IGNORECASE
    ).strip()

    if not clean_name:
        clean_name = f"dataset_{dataset_meta.get('id', 'export')}"

    is_syn = (
        bool(dataset_meta.get("synthetic_injected"))
        or str(dataset_meta.get("id", "")).startswith("ds_syn_")
        or "Synthetic" in str(dataset_meta.get("name", ""))
    )

    if is_syn:
        pct = compute_dynamic_injection_percentage(dataset_meta)
        clean_name = re.sub(
            r"^synthetic_(\d+%?_)?", "", clean_name, flags=re.IGNORECASE
        ).strip()
        return f"synthetic_{pct}%_{clean_name}.{ext}"

    return f"{clean_name}.{ext}"


def apply_dynamic_metadata(d: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures names, status, and error rate properties are consistent."""
    item = dict(d)
    is_syn = (
        str(item.get("id", "")).startswith("ds_syn_")
        or bool(item.get("synthetic_injected"))
        or "Synthetic" in str(item.get("name", ""))
    )

    rows = max(1, int(item.get("rows_count", item.get("rows", 1))))

    if is_syn:
        pct_display = compute_dynamic_injection_percentage(item)
        pct_fraction = round(pct_display / 100.0, 4)

        item["synthetic_injected"] = True
        item["injected_rate"] = pct_display
        item["error_rate"] = pct_fraction
        item["injected_percentage"] = f"{pct_display}%"
        item["name"] = format_dynamic_synthetic_name(item)
        item["status"] = "NEEDS_REMEDIATION"

        if not item.get("anomalies_count") or item.get("anomalies_count") == 0:
            item["anomalies_count"] = max(1, int(round(rows * pct_fraction)))
        item["anomalies"] = item["anomalies_count"]

        post_clean = item.get("post_clean_score") or item.get("quality_score")
        if post_clean is None:
            item["post_clean_score"] = round(
                max(0.40, 1.0 - (pct_fraction * 1.6)), 3
            )
            item["quality_score"] = item["post_clean_score"]
    else:
        item["synthetic_injected"] = False
        item["error_rate"] = 0.0
        item["status"] = item.get("status", "READY")
        if item.get("anomalies_count") is None:
            item["anomalies_count"] = 0
        item["anomalies"] = item["anomalies_count"]

    return item


def inject_anomalies_into_rows(
    rows: List[Dict[str, Any]],
    error_rate: float,
) -> Tuple[List[Dict[str, Any]], int]:
    """Mutates the calculated count of rows across the target dataset records."""
    if not rows:
        return [], 0

    mutated_rows = copy.deepcopy(rows)
    total_rows = len(mutated_rows)
    target_count = int(round(total_rows * error_rate))

    if target_count == 0:
        return mutated_rows, 0

    target_indices = random.sample(
        range(total_rows), min(target_count, total_rows)
    )
    anomalies_injected = 0

    for idx in target_indices:
        row = mutated_rows[idx]
        row["_data_status"] = "SYNTHETIC_ANOMALY"
        row["data_status"] = "SYNTHETIC_ANOMALY"
        anomalies_injected += 1

        if "systolic_bp" in row and "diastolic_bp" in row:
            if idx % 3 == 0:
                row["systolic_bp"] = random.choice([290, 315, 340])
                row["diastolic_bp"] = random.choice([155, 175])
            elif idx % 3 == 1:
                row["systolic_bp"] = 75
                row["diastolic_bp"] = 95
            else:
                row["diastolic_bp"] = -25
        elif "trestbps" in row:
            row["trestbps"] = random.choice([290, 310, 35])
        elif "chol" in row:
            row["chol"] = random.choice([750, 820, 45])
        elif "radius_mean" in row:
            row["radius_mean"] = random.choice([95.5, 110.0, -15.0])

        if "payer_code" in row:
            row["payer_code"] = "?"
        elif "weight" in row:
            row["weight"] = "?"
        elif "age" in row and idx % 4 == 0:
            row["age"] = "?"

        if "admission_date" in row and "discharge_date" in row:
            if idx % 2 == 0:
                row["admission_date"] = None
            else:
                row["admission_date"] = "2026-09-15"
                row["discharge_date"] = "2026-08-10"

        if "diag_1" in row and idx % 2 == 0:
            row["diag_1"] = f"ERR_ICD_{random.randint(100, 999)}!!"
        elif "diagnosis_code" in row and idx % 2 == 0:
            row["diagnosis_code"] = f"ERR_ICD_{random.randint(100, 999)}!!"

    return mutated_rows, anomalies_injected


# ===========================================================================
# 2. PERSISTENT DATASET & SAMPLE STORES (NO HARDCODED SEED DATASETS)
# ===========================================================================
DATASETS_STORE: List[Dict[str, Any]] = []
DATASET_SAMPLES_STORE: Dict[str, List[Dict[str, Any]]] = {}


def save_persisted_storage() -> None:
    """Saves all datasets and their records to disk without truncation."""
    try:
        PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
        clean_datasets = [apply_dynamic_metadata(d) for d in DATASETS_STORE]
        data = {
            "datasets": clean_datasets,
            "samples": DATASET_SAMPLES_STORE,
        }
        with open(PERSISTENCE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Persistence write failed: {e}")


def load_persisted_storage() -> None:
    """Loads persisted datasets and rows into memory without re-seeding dummy datasets."""
    loaded_datasets: List[Dict[str, Any]] = []
    loaded_samples: Dict[str, List[Dict[str, Any]]] = {}

    if PERSISTENCE_FILE.exists():
        try:
            with open(PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    loaded_datasets = data.get("datasets") or []
                    loaded_samples = data.get("samples") or {}
        except Exception as e:
            logger.warning(f"Persistence load notice: {e}")

    DATASETS_STORE.clear()
    DATASETS_STORE.extend([apply_dynamic_metadata(d) for d in loaded_datasets])

    DATASET_SAMPLES_STORE.clear()
    DATASET_SAMPLES_STORE.update(loaded_samples)


load_persisted_storage()


def add_or_update_dataset(
    dataset_meta: Dict[str, Any],
    samples: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Central registration function that mutates DATASETS_STORE and DATASET_SAMPLES_STORE in place."""
    normalized = apply_dynamic_metadata(dataset_meta)
    ds_id = str(normalized["id"])

    existing_idx = next(
        (i for i, d in enumerate(DATASETS_STORE) if str(d.get("id")) == ds_id),
        None,
    )
    if existing_idx is not None:
        DATASETS_STORE[existing_idx] = normalized
    else:
        DATASETS_STORE.insert(0, normalized)

    if samples is not None:
        DATASET_SAMPLES_STORE[ds_id] = samples
    elif ds_id not in DATASET_SAMPLES_STORE:
        DATASET_SAMPLES_STORE[ds_id] = []

    save_persisted_storage()
    return normalized


# ===========================================================================
# 3. ROUTE CONTROLLERS
# ===========================================================================
@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]], include_in_schema=False)
async def list_datasets(
    synthetic_only: Optional[bool] = Query(None),
    baseline_only: Optional[bool] = Query(None),
):
    """Returns all registered datasets with dynamic metadata."""
    dynamic_list = [apply_dynamic_metadata(d) for d in DATASETS_STORE]
    if synthetic_only:
        return [d for d in dynamic_list if d.get("synthetic_injected")]
    if baseline_only:
        return [d for d in dynamic_list if not d.get("synthetic_injected")]
    return dynamic_list


@router.post(
    "/inject",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/synthetic",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/{dataset_id}/inject",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
)
async def inject_synthetic_anomalies(
    dataset_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = Body(default={}),
):
    """Dynamically generates and registers a synthetic error partition from an existing dataset."""
    if not DATASETS_STORE:
        raise HTTPException(
            status_code=404,
            detail="No source dataset available. Upload a dataset first.",
        )

    p_dict = payload if isinstance(payload, dict) else {}
    config_value = p_dict.get("config")
    config_obj: Dict[str, Any] = (
        config_value if isinstance(config_value, dict) else {}
    )

    raw_target = (
        dataset_id
        or p_dict.get("dataset_id")
        or p_dict.get("datasetId")
        or config_obj.get("dataset_id")
        or config_obj.get("datasetId")
    )
    source_id = str(raw_target).strip() if raw_target else None

    source_ds = (
        next(
            (d for d in DATASETS_STORE if str(d.get("id")) == source_id), None
        )
        if source_id
        else DATASETS_STORE[0]
    )
    if not source_ds:
        raise HTTPException(
            status_code=404,
            detail=f"Source dataset '{source_id}' not found.",
        )

    source_id = str(source_ds.get("id"))
    base_samples = DATASET_SAMPLES_STORE.get(source_id) or []
    if not base_samples:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset '{source_id}' has no records to inject anomalies into.",
        )

    error_fraction, pct_display = parse_error_rate(p_dict, default=0.15)
    new_id = f"ds_syn_{pct_display}pct_{uuid.uuid4().hex[:6]}"

    mutated_samples, sample_anomalies = inject_anomalies_into_rows(
        base_samples, error_fraction
    )

    total_rows = len(mutated_samples)
    total_anomalies = sample_anomalies

    raw_name = str(source_ds.get("name", "dataset.csv"))
    clean_name = re.sub(
        r"\[Synthetic\s*\d*%?\]\s*", "", raw_name, flags=re.IGNORECASE
    ).strip()
    clean_name = re.sub(
        r"\s*\[Synthetic.*?\]", "", clean_name, flags=re.IGNORECASE
    ).strip()
    if not clean_name:
        clean_name = f"dataset_{source_id}.csv"

    new_meta = {
        "id": new_id,
        "name": f"[Synthetic {pct_display}%] {clean_name}",
        "source_dataset_id": source_id,
        "rows_count": total_rows,
        "rows": total_rows,
        "columns_count": source_ds.get(
            "columns_count",
            len(base_samples[0].keys()) if base_samples else 0,
        ),
        "file_size": source_ds.get("file_size", "0 B"),
        "uploaded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "NEEDS_REMEDIATION",
        "anomalies_count": total_anomalies,
        "anomalies": total_anomalies,
        "synthetic_injected": True,
        "error_rate": error_fraction,
        "injected_rate": pct_display,
        "injected_percentage": f"{pct_display}%",
        "post_clean_score": round(max(0.40, 1.0 - (error_fraction * 1.6)), 3),
        "quality_score": round(max(0.40, 1.0 - (error_fraction * 1.6)), 3),
        "flags": {
            "is_gold_standard": False,
            "anonymized": True,
            "auto_clean_enabled": True,
            "requires_human_review": True,
        },
    }

    registered_meta = add_or_update_dataset(new_meta, mutated_samples)

    logger.info(
        f"Registered synthetic dataset '{registered_meta['name']}' ({new_id}) with {total_anomalies} anomalies across {total_rows} records."
    )

    return {
        "status": "SUCCESS",
        "dataset": registered_meta,
        "new_dataset_id": new_id,
        "dataset_id": new_id,
        "name": registered_meta["name"],
        "source_dataset_id": source_id,
        "percentage": pct_display,
        "error_rate": error_fraction,
        "injected_rate": pct_display,
        "injected_percentage": f"{pct_display}%",
        "anomalies_count": total_anomalies,
        "injected_anomalies_count": total_anomalies,
        "sample_rows_corrupted": sample_anomalies,
        "message": f"Successfully created {registered_meta['name']} with {total_anomalies} anomalies across {total_rows} records.",
    }


@router.post("", response_model=Dict[str, Any])
@router.post("/", response_model=Dict[str, Any], include_in_schema=False)
async def register_dataset(payload: Dict[str, Any] = Body(...)):
    ds_id = str(payload.get("id") or f"ds_{uuid.uuid4().hex[:6]}")
    is_syn = bool(payload.get("synthetic_injected", ds_id.startswith("ds_syn_")))
    error_fraction, pct_display = parse_error_rate(
        payload, default=0.20 if is_syn else 0.0
    )

    samples = payload.get("samples") or payload.get("data") or []
    total_rows = int(payload.get("rows_count", payload.get("rows", len(samples))))
    anomalies_count = (
        max(1, int(round(total_rows * error_fraction)))
        if is_syn and total_rows > 0
        else int(payload.get("anomalies_count", 0))
    )

    raw_meta = {
        "id": ds_id,
        "name": payload.get("name", f"dataset_{ds_id}.csv"),
        "source_dataset_id": payload.get("source_dataset_id"),
        "rows_count": total_rows,
        "rows": total_rows,
        "columns_count": payload.get(
            "columns_count", len(samples[0].keys()) if samples else 0
        ),
        "file_size": payload.get("file_size", "0 B"),
        "uploaded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "NEEDS_REMEDIATION" if is_syn else "READY",
        "anomalies_count": anomalies_count,
        "anomalies": anomalies_count,
        "synthetic_injected": is_syn,
        "error_rate": error_fraction,
        "injected_rate": pct_display,
        "flags": payload.get(
            "flags",
            {
                "is_gold_standard": not is_syn,
                "anonymized": True,
                "auto_clean_enabled": True,
                "requires_human_review": is_syn,
            },
        ),
    }

    return add_or_update_dataset(raw_meta, samples)


@router.get("/{dataset_id}", response_model=Dict[str, Any])
async def get_dataset(dataset_id: str = FPath(...)):
    for ds in DATASETS_STORE:
        if str(ds["id"]) == str(dataset_id):
            return apply_dynamic_metadata(ds)
    raise HTTPException(
        status_code=404, detail=f"Dataset '{dataset_id}' not found."
    )


@router.delete("/{dataset_id}", response_model=Dict[str, Any])
async def delete_dataset(dataset_id: str = FPath(...)):
    target_idx = next(
        (
            i
            for i, d in enumerate(DATASETS_STORE)
            if str(d.get("id")) == str(dataset_id)
        ),
        None,
    )
    if target_idx is None:
        raise HTTPException(
            status_code=404, detail=f"Dataset '{dataset_id}' not found."
        )

    DATASETS_STORE.pop(target_idx)
    DATASET_SAMPLES_STORE.pop(str(dataset_id), None)
    save_persisted_storage()

    return {
        "status": "SUCCESS",
        "dataset_id": dataset_id,
        "remaining_count": len(DATASETS_STORE),
    }


@router.get("/{dataset_id}/sample", response_model=Dict[str, Any])
async def get_dataset_sample(
    dataset_id: str = FPath(...),
    limit: int = Query(50, ge=1, le=500),
):
    rows = DATASET_SAMPLES_STORE.get(str(dataset_id), [])
    if not rows and str(dataset_id).startswith("ds_syn_"):
        source_meta = next(
            (d for d in DATASETS_STORE if str(d["id"]) == str(dataset_id)), None
        )
        source_id = source_meta.get("source_dataset_id") if source_meta else None
        if source_id:
            rows = DATASET_SAMPLES_STORE.get(str(source_id), [])

    sample_slice = rows[:limit] if rows else []
    columns = list(sample_slice[0].keys()) if sample_slice else []

    return {
        "dataset_id": dataset_id,
        "sample_size": len(sample_slice),
        "total_records": len(rows),
        "columns": columns,
        "sample_rows": sample_slice,
        "rows": sample_slice,
        "data": sample_slice,
    }


# ===========================================================================
# 4. EXPORT ENDPOINTS WITH SYNTHETIC FILENAME FORMATTING
# ===========================================================================
@router.get("/{dataset_id}/export/csv")
async def export_dataset_csv(dataset_id: str = FPath(...)):
    """
    Streams the full dataset rows as CSV with formatted filename:
    e.g. 'synthetic_15%_heart.csv' or 'heart.csv'
    """
    rows = DATASET_SAMPLES_STORE.get(str(dataset_id), [])
    source_meta = next(
        (d for d in DATASETS_STORE if str(d.get("id")) == str(dataset_id)), None
    )

    if not rows and str(dataset_id).startswith("ds_syn_"):
        source_id = source_meta.get("source_dataset_id") if source_meta else None
        if source_id:
            rows = DATASET_SAMPLES_STORE.get(str(source_id), [])

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' has no records to export.",
        )

    meta = source_meta or {"id": dataset_id, "name": f"{dataset_id}.csv"}
    filename = format_export_filename(meta, ext="csv")

    df = pd.DataFrame(rows)
    stream = io.StringIO()
    df.to_csv(stream, index=False)

    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get("/{dataset_id}/export/json")
async def export_dataset_json(dataset_id: str = FPath(...)):
    """
    Streams the full dataset rows as JSON with formatted filename:
    e.g. 'synthetic_15%_heart.json' or 'heart.json'
    """
    rows = DATASET_SAMPLES_STORE.get(str(dataset_id), [])
    source_meta = next(
        (d for d in DATASETS_STORE if str(d.get("id")) == str(dataset_id)), None
    )

    if not rows and str(dataset_id).startswith("ds_syn_"):
        source_id = source_meta.get("source_dataset_id") if source_meta else None
        if source_id:
            rows = DATASET_SAMPLES_STORE.get(str(source_id), [])

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' has no records to export.",
        )

    meta = source_meta or {"id": dataset_id, "name": f"{dataset_id}.json"}
    filename = format_export_filename(meta, ext="json")

    payload = {
        "dataset_id": dataset_id,
        "dataset_name": filename,
        "total_records": len(rows),
        "records": rows,
    }
    json_str = json.dumps(payload, indent=2)

    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


# ===========================================================================
# 5. DATASET CONFIGURATION FLAGS
# ===========================================================================
@router.get("/{dataset_id}/flags", response_model=Dict[str, Any])
async def get_dataset_flags(dataset_id: str = FPath(...)):
    for ds in DATASETS_STORE:
        if str(ds["id"]) == str(dataset_id):
            return ds.get("flags", {})
    return {}


@router.patch("/{dataset_id}/flags", response_model=Dict[str, Any])
async def patch_dataset_flags(
    dataset_id: str = FPath(...), flags: Dict[str, Any] = Body(...)
):
    for ds in DATASETS_STORE:
        if str(ds["id"]) == str(dataset_id):
            for k, v in flags.items():
                ds[k] = v
            ds["flags"] = {**(ds.get("flags") or {}), **flags}
            save_persisted_storage()
            return {
                "dataset_id": dataset_id,
                "flags": ds["flags"],
                "excluded": ds.get("excluded", False),
                "hidden": ds.get("hidden", False),
                "status": "updated",
            }
    raise HTTPException(
        status_code=404, detail=f"Dataset '{dataset_id}' not found."
    )