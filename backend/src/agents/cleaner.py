"""
DataRA Pro - Cleaner Pipeline Route Handler
Executes autonomous multi-agent cleaning and persists cleaned dataset records.
"""

from typing import Dict, Any, Optional
import logging
from fastapi import APIRouter, Body, HTTPException, status
from src.routes.datasets import (
    DATASETS_STORE,
    DATASET_SAMPLES_STORE,
    save_persisted_storage
)
from src.agents.graph import AutonomousRemediationGraph

router = APIRouter(prefix="/api/cleaner", tags=["Cleaner"])
logger = logging.getLogger("datara.routes.cleaner")

graph_engine = AutonomousRemediationGraph()
LATEST_CLEANER_RESULTS: Dict[str, Any] = {}


@router.post("/run", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_200_OK, include_in_schema=False)
async def run_cleaner_pipeline(payload: Dict[str, Any] = Body(...)):
    """Executes the Auditor -> Remediator -> Validator loop on target datasets."""
    target_id = str(payload.get("dataset_id") or payload.get("datasetId") or "all")

    # Resolve target datasets
    if target_id == "all":
        datasets_to_process = [d["id"] for d in DATASETS_STORE if not d.get("hidden")]
    elif target_id == "synthetic_all":
        datasets_to_process = [d["id"] for d in DATASETS_STORE if d.get("synthetic_injected") or "ds_syn_" in str(d["id"])]
    else:
        datasets_to_process = [target_id]

    if not datasets_to_process:
        raise HTTPException(status_code=404, detail="No matching datasets found for remediation.")

    aggregated_results = []
    last_result = None

    for ds_id in datasets_to_process:
        records = DATASET_SAMPLES_STORE.get(ds_id, [])
        if not records:
            continue

        result = graph_engine.run(records, dataset_id=ds_id, max_iterations=5)
        last_result = result
        aggregated_results.append(result)

        # 1. Update stateful memory stores
        DATASET_SAMPLES_STORE[ds_id] = result["cleaned_records"]

        # 2. Update Dataset metadata in DATASETS_STORE
        for ds in DATASETS_STORE:
            if str(ds.get("id")) == str(ds_id):
                ds["status"] = "OPTIMAL" if result["cleaned_quality"] >= 0.95 else "NEEDS_REMEDIATION"
                ds["post_clean_score"] = result["cleaned_quality"]
                ds["anomalies_count"] = result["issues_after"]
                ds["anomalies"] = result["issues_after"]
                break

    # Persist changes to disk storage
    save_persisted_storage()

    primary_id = datasets_to_process[0]
    LATEST_CLEANER_RESULTS[primary_id] = last_result or {}

    return {
        "status": "SUCCESS",
        "dataset_id": target_id,
        "results": {
            "cleaner": last_result,
            "batch_processed": len(aggregated_results),
            "summary": last_result
        },
        "cleaner": last_result,
        "message": f"Successfully completed multi-agent remediation loop on {len(aggregated_results)} dataset(s)."
    }


@router.get("/metrics", response_model=Dict[str, Any])
async def get_cleaner_metrics(dataset_id: Optional[str] = "all"):
    """Returns the latest cleaning metrics computed dynamically."""
    target = dataset_id if dataset_id and dataset_id != "all" else "ds_001"
    res = LATEST_CLEANER_RESULTS.get(target) or next(iter(LATEST_CLEANER_RESULTS.values()), None)

    if not res:
        # Fallback to computing on current records
        records = DATASET_SAMPLES_STORE.get(target, [])
        res = graph_engine.run(records, dataset_id=target, max_iterations=1)

    return res
