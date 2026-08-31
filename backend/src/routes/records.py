#backend/src/routes/records.py
"""
Records Route Controller
Serves tabular records, row-level inspections, and pagination.
Supports dynamic schema definitions for breast cancer, diabetes, heart, and synthetic datasets.
"""

from fastapi import APIRouter, Query, Path, Request
from typing import Dict, Any, List, Optional
import logging

from src.routes.datasets import DATASETS_STORE, DATASET_SAMPLES_STORE

router = APIRouter()
logger = logging.getLogger("datara.routes.records")


def infer_column_type(key: str, sample_val: Any) -> str:
    """Helper to determine column formatting for the frontend table viewer."""
    if key in ["data_status", "_data_status", "status"]:
        return "badge"
    if "date" in key.lower() or "time" in key.lower():
        return "date"
    if isinstance(sample_val, (int, float)) and sample_val is not None:
        return "number"
    return "string"


def get_records_response(
    dataset_id: Optional[str],
    page: int = 1,
    page_size: int = 25,
    limit: Optional[int] = None,
    status_filter: Optional[str] = None,
) -> Dict[str, Any]:
    effective_limit = limit or page_size
    target_id = str(dataset_id or "").strip()

    # If "all", empty, or not specified, use the first available dataset
    if not target_id or target_id.lower() in ["all", "none", "undefined", "null"]:
        target_id = str(DATASETS_STORE[0]["id"]) if DATASETS_STORE else "ds_001"

    # Retrieve persisted rows from the shared store
    rows = DATASET_SAMPLES_STORE.get(target_id)

    # Fallback to source dataset if this synthetic dataset hasn't loaded in cache yet
    if not rows and target_id.startswith("ds_syn_"):
        source_meta = next((d for d in DATASETS_STORE if str(d["id"]) == target_id), None)
        source_id = source_meta.get("source_dataset_id", "ds_001") if source_meta else "ds_001"
        rows = DATASET_SAMPLES_STORE.get(source_id, DATASET_SAMPLES_STORE.get("ds_001", []))

    # Default fallback if store is completely empty
    if not rows:
        rows = DATASET_SAMPLES_STORE.get("ds_001", [
            {
                "id": 842302,
                "diagnosis": "M",
                "radius_mean": 17.99,
                "texture_mean": 10.38,
                "perimeter_mean": 122.8,
                "area_mean": 1001.0,
                "_data_status": "VALID",
            }
        ])

    # Apply row status filter only if not "ALL" / "ANY" / ""
    if status_filter and status_filter.upper() not in ["ALL", "ANY", "", "NONE", "*"]:
        rows = [
            r
            for r in rows
            if r.get("data_status") == status_filter
            or r.get("_data_status") == status_filter
            or r.get("status") == status_filter
        ]

    # Calculate pagination slice
    total_count = len(rows)
    start = (page - 1) * effective_limit
    end = start + effective_limit
    paginated_rows = rows[start:end] if start < len(rows) else []

    # Dynamically build columns matching the actual dataset schema
    columns = []
    if rows:
        sample_row = rows[0]
        for k, v in sample_row.items():
            label = k.lstrip("_").replace("_", " ").title()
            col_type = infer_column_type(k, v)
            columns.append({
                "key": k,
                "label": label,
                "type": col_type,
            })

    return {
        "dataset_id": target_id,
        "total": total_count,
        "total_records": total_count,
        "count": total_count,
        "page": page,
        "page_size": effective_limit,
        "limit": effective_limit,
        "columns": columns,
        "records": paginated_rows,
        "rows": paginated_rows,
        "items": paginated_rows,
        "data": paginated_rows,
    }


# Route 1: Handle Root Query: GET /api/records?dataset_id=...&page=1&page_size=25
@router.get("", response_model=Dict[str, Any])
@router.get("/", response_model=Dict[str, Any], include_in_schema=False)
async def get_records_root(
    dataset_id: Optional[str] = Query(None, description="The ID of the dataset"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Records per page"),
    limit: Optional[int] = Query(None, description="Limit alias for page_size"),
    status_filter: Optional[str] = Query(None, description="Filter by row status"),
):
    return get_records_response(
        dataset_id=dataset_id,
        page=page,
        page_size=page_size,
        limit=limit,
        status_filter=status_filter,
    )


# Route 2: Handle Path Parameter: GET /api/records/{dataset_id}?page=1&page_size=25
@router.get("/{dataset_id}", response_model=Dict[str, Any])
async def get_records_by_id(
    dataset_id: str = Path(..., description="The ID of the dataset to retrieve"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Records per page"),
    limit: Optional[int] = Query(None, description="Limit alias for page_size"),
    status_filter: Optional[str] = Query(None, description="Filter by row status"),
):
    return get_records_response(
        dataset_id=dataset_id,
        page=page,
        page_size=page_size,
        limit=limit,
        status_filter=status_filter,
    )