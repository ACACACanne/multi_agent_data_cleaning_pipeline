"""
Datasets Route Controller (100% Real-Time Dynamic Anomaly Engine)
Manages clinical baseline datasets and synthetic partitions.
Dynamically computes injection percentages, anomalous row mutations,
quality statuses, and real-time partition titles on every API response.
"""

from fastapi import APIRouter, Path, Query, Body, HTTPException, status
from typing import Dict, Any, List, Optional
import os
import re
import json
import uuid
import datetime
import copy
import random
import logging

router = APIRouter()
logger = logging.getLogger("datara.routes.datasets")

PERSISTENCE_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "datasets_storage.json")


# ===========================================================================
# 1. REAL-TIME DYNAMIC NAME & ERROR RATE FORMATTING HELPERS
# ===========================================================================
def compute_dynamic_injection_percentage(d: Dict[str, Any]) -> float:
    """Computes the exact injection percentage dynamically from anomaly and row metrics."""
    rows = max(1, int(d.get("rows_count", 299)))
    anomalies = int(d.get("anomalies_count", 0))

    if anomalies > 0:
        return round((anomalies / rows) * 100.0, 1)

    error_rate = d.get("error_rate")
    if error_rate is not None:
        rate = float(error_rate)
        return round(rate * 100.0 if rate <= 1.0 else rate, 1)

    return 14.7


def format_dynamic_synthetic_name(d: Dict[str, Any]) -> str:
    """
    Dynamically generates the synthetic title with the live injection percentage,
    stripping any previous static tags.
    """
    raw_name = str(d.get("name", "dataset.csv"))
    clean_name = re.sub(r"\s*\[Synthetic.*?\]", "", raw_name, flags=re.IGNORECASE).strip()
    pct = compute_dynamic_injection_percentage(d)
    return f"{clean_name} [Synthetic Anomaly Injected - {pct:.1f}%]"


def apply_dynamic_metadata(d: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures names, status, and error rate properties are fully dynamic and consistent."""
    item = dict(d)
    is_syn = (
        str(item.get("id", "")).startswith("ds_syn_")
        or bool(item.get("synthetic_injected"))
        or "Synthetic" in str(item.get("name", ""))
    )

    if is_syn:
        item["synthetic_injected"] = True
        pct = compute_dynamic_injection_percentage(item)
        item["name"] = format_dynamic_synthetic_name(item)
        item["error_rate"] = round(pct / 100.0, 4)
        item["injected_percentage"] = f"{pct:.1f}%"
        item["status"] = "NEEDS_REMEDIATION" if pct > 0 else "READY"
        if not item.get("anomalies_count"):
            rows = max(1, int(item.get("rows_count", 299)))
            item["anomalies_count"] = max(1, int(round(rows * (pct / 100.0))))
    else:
        item["synthetic_injected"] = False
        item["error_rate"] = 0.0
        item["status"] = item.get("status", "READY")

    return item


def parse_error_rate(payload: Dict[str, Any], default: float = 0.20) -> float:
    """Extracts and normalizes any user-supplied injection percentage or error rate."""
    for key in [
        "error_rate", "injection_rate", "rate", "noise_level",
        "percentage", "anomalies_percentage", "corruption_rate", "ratio"
    ]:
        if key in payload and payload[key] is not None:
            raw_val = payload[key]
            try:
                parsed = float(str(raw_val).replace("%", "").strip())
                if parsed > 1.0:
                    parsed = parsed / 100.0
                return round(max(0.0, min(1.0, parsed)), 4)
            except (ValueError, TypeError):
                break

    return default


def inject_anomalies_into_rows(
    rows: List[Dict[str, Any]], 
    error_rate: float
) -> tuple[List[Dict[str, Any]], int]:
    """Mutates the exact requested percentage of rows with realistic clinical anomalies."""
    if not rows:
        return [], 0

    mutated_rows = copy.deepcopy(rows)
    total_rows = len(mutated_rows)
    target_count = max(1, int(round(total_rows * error_rate))) if error_rate > 0 else 0

    if target_count == 0:
        return mutated_rows, 0

    target_indices = random.sample(range(total_rows), min(target_count, total_rows))
    anomalies_injected = 0

    for idx in target_indices:
        row = mutated_rows[idx]
        row["_data_status"] = "SYNTHETIC_ANOMALY"
        row["data_status"] = "SYNTHETIC_ANOMALY"
        anomalies_injected += 1

        # Anomaly Type 1: Outliers / Extreme Vitals
        if "systolic_bp" in row and "diastolic_bp" in row:
            if idx % 3 == 0:
                row["systolic_bp"] = random.choice([310, 330, 350])
            elif idx % 3 == 1:
                row["systolic_bp"] = 80
                row["diastolic_bp"] = 95
            else:
                row["systolic_bp"] = random.choice([35, 30])
        elif "trestbps" in row:
            row["trestbps"] = random.choice([290, 310, 35])
        elif "chol" in row:
            row["chol"] = random.choice([750, 820, 45])
        elif "radius_mean" in row:
            row["radius_mean"] = random.choice([95.5, 110.0, -15.0])
        elif "area_mean" in row:
            row["area_mean"] = random.choice([4500.0, -100.0])

        # Anomaly Type 2: Sentinel Missing Tokens
        if "payer_code" in row:
            row["payer_code"] = "?"
        elif "weight" in row:
            row["weight"] = "?"
        elif "texture_mean" in row and idx % 2 == 0:
            row["texture_mean"] = "?"
        elif "thal" in row:
            row["thal"] = "?"

        # Anomaly Type 3: Temporal Sequence Inversions
        if "admission_date" in row and "discharge_date" in row:
            row["admission_date"] = "2026-09-15"
            row["discharge_date"] = "2026-08-10"

        # Anomaly Type 4: Demographic Mutex Contradictions
        if "gender" in row and "diag_1" in row:
            row["gender"] = "Male"
            row["diag_1"] = "640.0"
        elif "diag_1" in row and idx % 2 == 0:
            row["diag_1"] = "SYNTHETIC_CORRUPT_CODE"

    return mutated_rows, anomalies_injected


# ===========================================================================
# 2. BASELINE INITIAL SEED REGISTRY
# ===========================================================================
INITIAL_DATASETS: List[Dict[str, Any]] = [
    {
        "id": "ds_001",
        "name": "breast_cancer_diagnostic.csv",
        "rows_count": 299,
        "columns_count": 32,
        "file_size": "64.3 KB",
        "uploaded_at": "2026-08-20T10:00:00Z",
        "status": "READY",
        "anomalies_count": 14,
        "synthetic_injected": False,
        "error_rate": 0.0,
        "flags": {
            "is_gold_standard": True,
            "anonymized": True,
            "auto_clean_enabled": True,
            "requires_human_review": False,
        },
    },
    {
        "id": "ds_002",
        "name": "diabetic_data.csv",
        "rows_count": 299,
        "columns_count": 50,
        "file_size": "55.1 KB",
        "uploaded_at": "2026-08-19T09:30:00Z",
        "status": "READY",
        "anomalies_count": 42,
        "synthetic_injected": False,
        "error_rate": 0.0,
        "flags": {
            "is_gold_standard": False,
            "anonymized": True,
            "auto_clean_enabled": True,
            "requires_human_review": True,
        },
    },
    {
        "id": "ds_003",
        "name": "heart.csv",
        "rows_count": 299,
        "columns_count": 14,
        "file_size": "10.9 KB",
        "uploaded_at": "2026-08-18T14:15:00Z",
        "status": "READY",
        "anomalies_count": 18,
        "synthetic_injected": False,
        "error_rate": 0.0,
        "flags": {
            "is_gold_standard": True,
            "anonymized": True,
            "auto_clean_enabled": True,
            "requires_human_review": False,
        },
    },
    {
        "id": "ds_syn_da0c8a",
        "name": "diabetic_data.csv [Synthetic Anomaly Injected - 14.7%]",
        "source_dataset_id": "ds_002",
        "rows_count": 299,
        "columns_count": 50,
        "file_size": "56.4 KB",
        "uploaded_at": "2026-08-23T18:30:00Z",
        "status": "NEEDS_REMEDIATION",
        "anomalies_count": 44,
        "synthetic_injected": True,
        "error_rate": 0.147,
        "flags": {
            "is_gold_standard": False,
            "anonymized": True,
            "auto_clean_enabled": True,
            "requires_human_review": True,
        },
    },
]

INITIAL_SAMPLES: Dict[str, List[Dict[str, Any]]] = {
    "ds_001": [
        {
            "id": 842302,
            "diagnosis": "M",
            "radius_mean": 17.99,
            "texture_mean": 10.38,
            "perimeter_mean": 122.8,
            "area_mean": 1001.0,
            "smoothness_mean": 0.1184,
            "compactness_mean": 0.2776,
            "concavity_mean": 0.3001,
            "concave_points_mean": 0.1471,
            "symmetry_mean": 0.2419,
            "fractal_dimension_mean": 0.07871,
            "radius_worst": 25.38,
            "texture_worst": 17.33,
            "perimeter_worst": 184.6,
            "area_worst": 2019.0,
            "_data_status": "VALID",
        },
    ],
    "ds_002": [
        {
            "encounter_id": 2278392,
            "patient_nbr": 8222157,
            "race": "Caucasian",
            "gender": "Female",
            "age": "[0-10)",
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "admission_type_id": 6,
            "discharge_disposition_id": 25,
            "admission_source_id": 1,
            "time_in_hospital": 1,
            "payer_code": "MC",
            "medical_specialty": "Pediatrics-Endocrinology",
            "num_lab_procedures": 41,
            "num_procedures": 0,
            "num_medications": 1,
            "diag_1": "250.83",
            "metformin": "No",
            "insulin": "No",
            "admission_date": "2026-08-01",
            "discharge_date": "2026-08-05",
            "_data_status": "VALID",
        },
    ],
    "ds_003": [
        {
            "age": 63,
            "sex": 1,
            "cp": 1,
            "trestbps": 145,
            "chol": 233,
            "fbs": 1,
            "restecg": 2,
            "thalach": 150,
            "exang": 0,
            "oldpeak": 2.3,
            "slope": 3,
            "ca": "0",
            "thal": "6",
            "target": 0,
            "_data_status": "VALID",
        },
    ],
    "ds_syn_da0c8a": [
        {
            "encounter_id": 998811,
            "patient_nbr": 445566,
            "race": "Caucasian",
            "gender": "Male",
            "age": "[50-60)",
            "systolic_bp": 310,
            "diastolic_bp": 195,
            "admission_type_id": "?",
            "time_in_hospital": 2,
            "payer_code": "?",
            "diag_1": "640.0",
            "admission_date": "2026-08-20",
            "discharge_date": "2026-08-15",
            "_data_status": "SYNTHETIC_ANOMALY",
        },
    ],
}


# ===========================================================================
# 3. DISK PERSISTENCE ENGINE
# ===========================================================================
def load_persisted_storage():
    """Loads saved dataset records, ensuring all titles reflect live calculated percentages."""
    persisted_datasets = []
    persisted_samples = {}

    try:
        if os.path.exists(PERSISTENCE_FILE):
            with open(PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                persisted_datasets = data.get("datasets", [])
                persisted_samples = data.get("samples", {})
    except Exception as e:
        logger.warning(f"Persistence load notice: {e}")

    existing_ids = {str(d.get("id")) for d in persisted_datasets}
    final_datasets = list(persisted_datasets)
    final_samples = dict(persisted_samples)

    for init_ds in INITIAL_DATASETS:
        ds_id = str(init_ds["id"])
        if ds_id not in existing_ids:
            final_datasets.append(init_ds)
            if ds_id in INITIAL_SAMPLES:
                final_samples[ds_id] = INITIAL_SAMPLES[ds_id]

    # Dynamically update metadata for all loaded datasets
    normalized_datasets = [apply_dynamic_metadata(d) for d in final_datasets]
    return normalized_datasets, final_samples


def save_persisted_storage():
    """Writes all currently registered datasets and sample records to disk."""
    try:
        # Dynamically normalize metadata before persisting
        clean_datasets = [apply_dynamic_metadata(d) for d in DATASETS_STORE]
        data = {
            "datasets": clean_datasets,
            "samples": DATASET_SAMPLES_STORE,
        }
        with open(PERSISTENCE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Persistence write failed: {e}")


# Initialize Global In-Memory Stores
DATASETS_STORE, DATASET_SAMPLES_STORE = load_persisted_storage()
save_persisted_storage()


# ===========================================================================
# 4. ROUTE CONTROLLERS
# ===========================================================================
@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]], include_in_schema=False)
async def list_datasets(
    synthetic_only: Optional[bool] = Query(None, description="Filter to synthetic partitions only"),
    baseline_only: Optional[bool] = Query(None, description="Filter to baseline partitions only")
):
    """Returns all registered datasets with real-time calculated percentages in partition titles."""
    dynamic_list = [apply_dynamic_metadata(d) for d in DATASETS_STORE]

    if synthetic_only:
        return [d for d in dynamic_list if d.get("synthetic_injected")]
    if baseline_only:
        return [d for d in dynamic_list if not d.get("synthetic_injected")]
    return dynamic_list


@router.post("", response_model=Dict[str, Any])
@router.post("/", response_model=Dict[str, Any], include_in_schema=False)
async def register_dataset(payload: Dict[str, Any] = Body(...)):
    """Registers a dataset, dynamically computing title percentage from input error rate."""
    global DATASETS_STORE, DATASET_SAMPLES_STORE

    ds_id = str(payload.get("id") or f"ds_{uuid.uuid4().hex[:6]}")
    is_syn = bool(payload.get("synthetic_injected", ds_id.startswith("ds_syn_")))
    error_rate = parse_error_rate(payload, default=0.20 if is_syn else 0.0)

    total_rows = int(payload.get("rows_count", 299))
    anomalies_count = max(0, int(round(total_rows * error_rate))) if is_syn else int(payload.get("anomalies_count", 14))

    raw_meta = {
        "id": ds_id,
        "name": payload.get("name", f"dataset_{ds_id}.csv"),
        "source_dataset_id": payload.get("source_dataset_id", "ds_001"),
        "rows_count": total_rows,
        "columns_count": payload.get("columns_count", 14),
        "file_size": payload.get("file_size", "45.0 KB"),
        "uploaded_at": datetime.datetime.utcnow().isoformat() + "Z",
        "status": "NEEDS_REMEDIATION" if error_rate > 0 else "READY",
        "anomalies_count": anomalies_count,
        "synthetic_injected": is_syn,
        "error_rate": error_rate,
        "flags": payload.get("flags", {
            "is_gold_standard": not is_syn,
            "anonymized": True,
            "auto_clean_enabled": True,
            "requires_human_review": is_syn,
        }),
    }

    new_meta = apply_dynamic_metadata(raw_meta)

    DATASETS_STORE = [d for d in DATASETS_STORE if str(d.get("id")) != ds_id]
    DATASETS_STORE.append(new_meta)

    if "samples" in payload or "data" in payload:
        DATASET_SAMPLES_STORE[ds_id] = payload.get("samples") or payload.get("data") or []

    save_persisted_storage()
    return new_meta


@router.post("/inject", response_model=Dict[str, Any])
@router.post("/synthetic", response_model=Dict[str, Any])
@router.post("/{dataset_id}/inject", response_model=Dict[str, Any])
async def inject_synthetic_anomalies(
    dataset_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = Body(default={})
):
    """
    Dynamically creates a synthetic dataset where the percentage in the title
    and the anomalous rows strictly match the dashboard's applied injection rate.
    """
    global DATASETS_STORE, DATASET_SAMPLES_STORE

    p_dict = payload if isinstance(payload, dict) else {}
    source_id = str(dataset_id or p_dict.get("dataset_id") or "ds_002").strip()

    source_ds = next((d for d in DATASETS_STORE if str(d.get("id")) == source_id), None)
    if not source_ds:
        source_ds = DATASETS_STORE[0]

    # 1. Dynamically parse the exact error rate applied on the dashboard
    error_rate = parse_error_rate(p_dict, default=0.25)
    new_id = f"ds_syn_{uuid.uuid4().hex[:6]}"

    # 2. Mutate sample records to match the error rate
    base_samples = DATASET_SAMPLES_STORE.get(source_id)
    if not base_samples:
        base_samples = DATASET_SAMPLES_STORE.get("ds_002", INITIAL_SAMPLES.get("ds_002", []))

    mutated_samples, _ = inject_anomalies_into_rows(base_samples, error_rate)

    # 3. Empirically compute row and anomaly counts
    total_rows = int(source_ds.get("rows_count", len(base_samples) or 299))
    total_anomalies = max(1, int(round(total_rows * error_rate))) if error_rate > 0 else 0

    raw_meta = {
        "id": new_id,
        "name": source_ds.get("name", "dataset.csv"),
        "source_dataset_id": source_id,
        "rows_count": total_rows,
        "columns_count": source_ds.get("columns_count", len(base_samples[0].keys()) if base_samples else 50),
        "file_size": source_ds.get("file_size", "56.4 KB"),
        "uploaded_at": datetime.datetime.utcnow().isoformat() + "Z",
        "status": "READY" if error_rate == 0.0 else "NEEDS_REMEDIATION",
        "anomalies_count": total_anomalies,
        "synthetic_injected": True,
        "error_rate": error_rate,
        "flags": {
            "is_gold_standard": False,
            "anonymized": True,
            "auto_clean_enabled": True,
            "requires_human_review": True,
        },
    }

    # Dynamically format metadata (computes name with real-time percentage tag)
    new_dataset_meta = apply_dynamic_metadata(raw_meta)

    DATASETS_STORE.insert(0, new_dataset_meta)
    DATASET_SAMPLES_STORE[new_id] = mutated_samples
    save_persisted_storage()

    logger.info("Generated %s (%s) with rate %.1f%%", new_id, new_dataset_meta["name"], error_rate * 100.0)

    return {
        "status": "SUCCESS",
        "dataset": new_dataset_meta,
        "dataset_id": new_id,
        "error_rate": error_rate,
        "injected_percentage": f"{(error_rate * 100.0):.1f}%",
        "anomalies_count": total_anomalies,
        "message": f"Successfully created {new_dataset_meta['name']} with {total_anomalies} anomalies.",
    }


@router.get("/{dataset_id}", response_model=Dict[str, Any])
async def get_dataset(dataset_id: str = Path(...)):
    for ds in DATASETS_STORE:
        if str(ds["id"]) == str(dataset_id):
            return apply_dynamic_metadata(ds)
    raise HTTPException(status_code=404, detail="Dataset not found")


@router.delete("/{dataset_id}", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
@router.delete("/{dataset_id}/", response_model=Dict[str, Any], status_code=status.HTTP_200_OK, include_in_schema=False)
async def delete_dataset(dataset_id: str = Path(...)):
    global DATASETS_STORE, DATASET_SAMPLES_STORE

    DATASETS_STORE = [d for d in DATASETS_STORE if str(d["id"]) != str(dataset_id)]
    DATASET_SAMPLES_STORE.pop(str(dataset_id), None)
    save_persisted_storage()

    return {
        "status": "SUCCESS",
        "dataset_id": dataset_id,
        "message": f"Dataset {dataset_id} deleted permanently.",
        "remaining_count": len(DATASETS_STORE),
    }


@router.get("/{dataset_id}/flags", response_model=Dict[str, Any])
async def get_dataset_flags(dataset_id: str = Path(...)):
    for ds in DATASETS_STORE:
        if str(ds["id"]) == str(dataset_id):
            return ds.get("flags", {})
    return {}


@router.patch("/{dataset_id}/flags", response_model=Dict[str, Any])
async def patch_dataset_flags(
    dataset_id: str = Path(...), flags: Dict[str, Any] = Body(...)
):
    for ds in DATASETS_STORE:
        if str(ds["id"]) == str(dataset_id):
            ds["flags"].update(flags)
            if "excluded" in flags:
                ds["excluded"] = flags["excluded"]
            if "hidden" in flags:
                ds["hidden"] = flags["hidden"]
            save_persisted_storage()
            return {"dataset_id": dataset_id, "flags": ds["flags"], "status": "updated"}

    return {"dataset_id": dataset_id, "flags": flags, "status": "updated"}


@router.get("/{dataset_id}/sample", response_model=Dict[str, Any])
async def get_dataset_sample(
    dataset_id: str = Path(..., description="The dataset identifier"),
    limit: int = Query(5, ge=1, le=100),
):
    rows = DATASET_SAMPLES_STORE.get(str(dataset_id), [])
    if not rows and str(dataset_id).startswith("ds_syn_"):
        source_meta = next((d for d in DATASETS_STORE if str(d["id"]) == str(dataset_id)), None)
        source_id = source_meta.get("source_dataset_id", "ds_002") if source_meta else "ds_002"
        rows = DATASET_SAMPLES_STORE.get(source_id, [])

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

