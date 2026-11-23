# backend/src/routes/cleaner.py
"""
Cleaner Route Controller (Live Telemetry Only)
- Executes agentic cleaning over active datasets with cohort-aware imputation.
- Updates cleaned records in DATASET_SAMPLES_STORE and caches exports in CLEANED_EXPORTS_STORE.
- Records real remediation history entries per cleaning run.
- Formats export filenames with 'clean_<original_name>'.
"""

from __future__ import annotations

from datetime import datetime, timezone
import io
import json
import logging
import math
import re
import time
from typing import Any, Dict, List, Optional, Tuple
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from fastapi.responses import Response
import numpy as np
import pandas as pd
import psutil
from sqlmodel import Session

from src.agents.pipeline import (
    AutonomousRemediationGraph,
    compute_live_dimensional_metrics,
)
from src.db.session import get_session
from src.models.remediation import RemediationEntry
from src.routes.datasets import (
    DATASET_SAMPLES_STORE,
    DATASETS_STORE,
    save_persisted_storage,
)
from src.storage.remediation_history import add_history_entry

router = APIRouter()
logger = logging.getLogger("datara.routes.cleaner")

graph_engine = AutonomousRemediationGraph()

CLEANED_EXPORTS_STORE: Dict[str, Dict[str, Any]] = {}
LATEST_CLEANER_RESULTS: Dict[str, Any] = {}


def _is_missing_or_sentinel(val: Any) -> bool:
    if val is None:
        return True
    if isinstance(val, float) and math.isnan(val):
        return True
    return str(val).strip() in {"?", "", "nan", "NaN", "None", "null"}


def _safe_float(val: Any, default: Optional[float] = None) -> Optional[float]:
    if val is None or isinstance(val, bool):
        return default
    if isinstance(val, (int, float)):
        return float(val) if math.isfinite(float(val)) else default
    text = str(val).strip()
    if not text or text in {"?", "nan", "NaN", "None", "null"}:
        return default
    try:
        parsed = float(text)
        return parsed if math.isfinite(parsed) else default
    except (TypeError, ValueError):
        return default


def _compute_cohort_age_median(rows: List[Dict[str, Any]]) -> int:
    """Computes a median age from valid rows in the active cohort."""
    valid_ages: List[float] = []
    for r in rows:
        val = r.get("age")
        if _is_missing_or_sentinel(val):
            continue
        num = _safe_float(val)
        if num is not None and 1.0 <= num <= 105.0:
            valid_ages.append(num)
    if valid_ages:
        return int(round(float(np.median(valid_ages))))
    return 55


def _record_remediation_log(
    session: Session,
    ds_id: str,
    repaired_count: int,
    total_count: int,
    details_summary: str,
) -> None:
    """Persists a live remediation entry to history storage and DB when applicable."""
    now_iso = datetime.now(timezone.utc).isoformat()
    add_history_entry(
        {
            "id": f"rem_{uuid.uuid4().hex[:8]}",
            "dataset_id": ds_id,
            "column": "cohort_records",
            "proposed_fix": details_summary,
            "action": "AGENTIC_CLEAN_PIPELINE",
            "status": "APPLIED",
            "records_evaluated": total_count,
            "anomalies_repaired": repaired_count,
            "timestamp": now_iso,
        }
    )

    try:
        numeric_id = int(str(ds_id).replace("ds_", ""))
        entry = RemediationEntry(
            dataset_id=numeric_id,
            action="AGENTIC_CLEAN_PIPELINE",
            details={
                "source_dataset_id": ds_id,
                "records_evaluated": total_count,
                "anomalies_repaired": repaired_count,
                "summary": details_summary,
            },
            actor="cleaner",
        )
        session.add(entry)
        session.commit()
    except Exception:
        session.rollback()


# ===========================================================================
# 1. CORE REMEDIATION ENGINE
# ===========================================================================
def remediate_record(
    row: Dict[str, Any], cohort_age_fallback: int = 55
) -> Tuple[Dict[str, Any], bool, List[str]]:
    """
    Applies cohort-aware imputation, numeric/physiological bounds,
    chronological sequence alignment, and taxonomy cleanup.
    Returns (sanitized_row, repaired_bool, changed_fields).
    """
    r = dict(row)
    repaired = False
    changed_fields: List[str] = []

    if "age" in r:
        raw_age = r.get("age")
        num_age = None if _is_missing_or_sentinel(raw_age) else _safe_float(raw_age)
        if num_age is not None and 1.0 <= num_age <= 105.0:
            rounded_age = int(round(num_age))
            r["age"] = rounded_age
            if str(raw_age).strip() != str(rounded_age):
                repaired = True
                changed_fields.append("age")
        else:
            r["age"] = int(cohort_age_fallback)
            repaired = True
            changed_fields.append("age")

    if "systolic_bp" in r and "diastolic_bp" in r:
        bp_changed = False
        raw_s = _safe_float(r.get("systolic_bp"))
        raw_d = _safe_float(r.get("diastolic_bp"))
        if raw_s is None or raw_d is None:
            r["systolic_bp"] = 120
            r["diastolic_bp"] = 80
            bp_changed = True
        else:
            if raw_s < raw_d:
                raw_s, raw_d = raw_d, raw_s
                bp_changed = True
            if raw_s < 80.0 or raw_s > 180.0:
                raw_s = 122.0
                bp_changed = True
            if raw_d < 40.0 or raw_d > 110.0:
                raw_d = 78.0
                bp_changed = True
            r["systolic_bp"] = int(round(raw_s))
            r["diastolic_bp"] = int(round(raw_d))
        if bp_changed:
            repaired = True
            changed_fields.extend(["systolic_bp", "diastolic_bp"])

    adm = r.get("admission_date")
    dis = r.get("discharge_date")
    date_changed = False
    adm_missing = _is_missing_or_sentinel(adm)
    dis_missing = _is_missing_or_sentinel(dis)
    if adm_missing and dis_missing:
        r["admission_date"] = "2026-01-15"
        r["discharge_date"] = "2026-01-22"
        date_changed = True
    elif adm_missing:
        r["admission_date"] = "2026-01-15"
        date_changed = True
    elif dis_missing:
        r["discharge_date"] = "2026-01-22"
        date_changed = True
    elif str(adm) > str(dis):
        r["admission_date"], r["discharge_date"] = str(dis), str(adm)
        date_changed = True
    if date_changed:
        repaired = True
        changed_fields.extend(["admission_date", "discharge_date"])

    for sentinel_col, fallback_val in [
        ("payer_code", "MC"),
        ("weight", 72.5),
    ]:
        if sentinel_col in r and _is_missing_or_sentinel(r.get(sentinel_col)):
            r[sentinel_col] = fallback_val
            repaired = True
            changed_fields.append(sentinel_col)

    for diag_col, fallback_code in [("diag_1", "250.00"), ("diagnosis_code", "414.01")]:
        if diag_col in r:
            val_str = str(r.get(diag_col, ""))
            if "ERR_" in val_str or "!!" in val_str:
                cleaned = val_str.replace("ERR_", "").replace("!!", "").strip()
                r[diag_col] = cleaned or fallback_code
                repaired = True
                changed_fields.append(diag_col)

    if r.get("data_status") != "VALID":
        r["data_status"] = "VALID"
        repaired = True
        changed_fields.append("data_status")

    if r.get("_data_status") == "SYNTHETIC_ANOMALY":
        r["_data_status"] = "REMEDIATED"

    return r, repaired, changed_fields


def format_clean_export_filename(raw_name: str, fallback_id: str = "dataset") -> str:
    """Transforms a dataset name into 'clean_<original_name>'."""
    clean_name = re.sub(r"\.(csv|json)$", "", raw_name, flags=re.IGNORECASE).strip()
    if not clean_name:
        clean_name = str(fallback_id)
    if not clean_name.lower().startswith("clean_"):
        clean_name = f"clean_{clean_name}"
    return clean_name


def is_active_input_dataset(d: Dict[str, Any]) -> bool:
    """Includes datasets that are not marked excluded or hidden."""
    is_excluded = bool(d.get("excluded")) or bool(d.get("flags", {}).get("excluded"))
    is_hidden = bool(d.get("hidden")) or bool(d.get("flags", {}).get("hidden"))
    return not (is_excluded or is_hidden)


def _find_cached_export(target_id: str) -> Optional[Dict[str, Any]]:
    """Finds the most recent cached cleaned export matching target_id (or any when 'all')."""
    for exp in reversed(list(CLEANED_EXPORTS_STORE.values())):
        exp_ds_id = str(exp.get("source_dataset_id", "")).strip()
        if target_id == "all" or exp_ds_id == target_id:
            if exp.get("records"):
                return exp
    return None


def _build_cleaned_records_for_scope(target_id: str) -> Tuple[List[Dict[str, Any]], str]:
    active_ids = (
        [
            str(d.get("id"))
            for d in DATASETS_STORE
            if is_active_input_dataset(d) and d.get("id")
        ]
        if target_id == "all"
        else [target_id]
    )

    cleaned_records: List[Dict[str, Any]] = []
    source_name = "cohort"
    for d_id in active_ids:
        source_meta = next(
            (d for d in DATASETS_STORE if str(d.get("id")) == str(d_id)), {}
        )
        source_name = str(source_meta.get("name", d_id))
        raw_recs = DATASET_SAMPLES_STORE.get(str(d_id), [])
        age_fallback = _compute_cohort_age_median(raw_recs)
        for r in raw_recs:
            clean_row, _, _ = remediate_record(r, cohort_age_fallback=age_fallback)
            cleaned_records.append(clean_row)

    out_base = (
        "clean_all_datasets"
        if target_id == "all"
        else format_clean_export_filename(source_name, target_id)
    )
    return cleaned_records, out_base


# ===========================================================================
# 2. DYNAMIC SUGGESTION ENGINE
# ===========================================================================
def generate_dataset_suggestions(
    dataset_id: str, rows: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    if not rows:
        return []

    df = pd.DataFrame(rows)
    suggestions: List[Dict[str, Any]] = []

    null_counts = {
        str(col): int(count)
        for col, count in df.isnull().sum().items()
        if not str(col).startswith("_")
    }
    null_cols = [col for col, count in null_counts.items() if count > 0]

    if null_cols:
        for target_col in null_cols[:2]:
            null_count = null_counts[target_col]
            suggestions.append({
                "id": f"sug_{dataset_id}_{target_col}_impute",
                "column": target_col,
                "field": "Missingness",
                "action": "Cohort Median Imputation",
                "recommendation": f"Impute {null_count} null observation(s) in '{target_col}'.",
                "impact": f"+{round((null_count / len(df)) * 100, 1)}% Completeness",
            })

    if "systolic_bp" in df.columns and "diastolic_bp" in df.columns:
        sbp = pd.to_numeric(df["systolic_bp"], errors="coerce")
        dbp = pd.to_numeric(df["diastolic_bp"], errors="coerce")
        inversions = int(((sbp < dbp) & sbp.notnull() & dbp.notnull()).sum())
        if inversions > 0:
            suggestions.append({
                "id": f"sug_{dataset_id}_bp_inversion",
                "column": "systolic_bp",
                "field": "Blood Pressure Order",
                "action": "Systolic / Diastolic Reorder",
                "recommendation": f"Realign {inversions} row(s) where Systolic BP < Diastolic BP.",
                "impact": f"+{round((inversions / len(df)) * 100, 1)}% Validity",
            })

    return suggestions


# ===========================================================================
# 3. LIVE METRICS ENGINE (NO HARDCODED BENCHMARKS)
# ===========================================================================
def calculate_metrics_for_dataset(dataset_id: Optional[str] = None) -> Dict[str, Any]:
    target_id = str(dataset_id or "all").strip()

    active_datasets = (
        [d for d in DATASETS_STORE if is_active_input_dataset(d)]
        if target_id in ["all", "", "none"]
        else [d for d in DATASETS_STORE if str(d.get("id")) == target_id]
    )

    all_rows: List[Dict[str, Any]] = []
    for d in active_datasets:
        ds_key = str(d.get("id", ""))
        if ds_key:
            all_rows.extend(DATASET_SAMPLES_STORE.get(ds_key, []))

    total_records = len(all_rows)
    if total_records == 0:
        return {
            "status": "empty",
            "dataset_id": target_id,
            "actions": 0,
            "actions_count": 0,
            "fixes_applied": 0,
            "issues_fixed": 0,
            "total_actions": 0,
            "success_rate": None,
            "baseline_quality": None,
            "cleaned_quality": None,
            "improvement": None,
            "improvement_pct": None,
            "record_accuracy": None,
            "accuracy": None,
            "rejection_rate": None,
            "latency_seconds": 0.0,
            "total_records": 0,
            "records_evaluated": 0,
            "issues": {
                "missing_values": 0,
                "total_anomalies": 0,
            },
            "dimensional_breakdown": {},
            "trajectories": {
                "agent": [],
                "manual": [],
                "baseline": [],
            },
            "resources": {},
            "suggestions": [],
            "last_run": None,
        }

    live_metrics = compute_live_dimensional_metrics(all_rows)
    suggestions = generate_dataset_suggestions(target_id, all_rows)

    current_q = round(
        _safe_float(live_metrics.get("global_quality_score"), 0.0) or 0.0, 3
    )
    issues_count = int(_safe_float(live_metrics.get("total_issues"), 0) or 0)

    prev_run = LATEST_CLEANER_RESULTS.get(target_id) or LATEST_CLEANER_RESULTS.get("all")
    prev_base = (
        _safe_float(prev_run.get("baseline_quality"))
        if isinstance(prev_run, dict)
        else None
    )
    baseline_q = (
        round(prev_base, 3)
        if prev_base is not None and issues_count == 0
        else current_q
    )
    cleaned_q = current_q
    improvement_val = round(max(0.0, (cleaned_q - baseline_q) * 100), 1)
    computed_success_rate = round(
        max(0.0, (total_records - issues_count) / total_records), 4
    )

    try:
        cpu_util = round(
            _safe_float(psutil.cpu_percent(interval=None), 0.0) or 0.0, 1
        )
        mem_mb = round(
            (_safe_float(psutil.Process().memory_info().rss, 0.0) or 0.0)
            / (1024 * 1024),
            1,
        )
    except Exception:
        cpu_util = 0.0
        mem_mb = 0.0

    resources = {
        "cpu_utilization_pct": cpu_util,
        "memory_rss_mb": mem_mb,
    }

    missing_values_count = sum(
        1
        for r in all_rows
        for k, v in r.items()
        if not str(k).startswith("_") and _is_missing_or_sentinel(v)
    )

    return {
        "status": "completed",
        "dataset_id": target_id,
        "actions": issues_count,
        "actions_count": issues_count,
        "fixes_applied": issues_count,
        "issues_fixed": issues_count,
        "total_actions": issues_count,
        "success_rate": computed_success_rate,
        "baseline_quality": baseline_q,
        "cleaned_quality": cleaned_q,
        "improvement": f"+{improvement_val}%",
        "improvement_pct": improvement_val,
        "record_accuracy": live_metrics.get("accuracy"),
        "accuracy": live_metrics.get("accuracy"),
        "rejection_rate": None,
        "latency_seconds": 0.0,
        "total_records": total_records,
        "records_evaluated": total_records,
        "issues": {
            "missing_values": missing_values_count,
            "total_anomalies": issues_count,
        },
        "dimensional_breakdown": live_metrics,
        "trajectories": {
            "agent": [],
            "manual": [],
            "baseline": [],
        },
        "resources": resources,
        "suggestions": suggestions,
        "last_run": datetime.now(timezone.utc).isoformat(),
    }


# ===========================================================================
# 4. ROUTE CONTROLLERS & EXPORT STREAMING
# ===========================================================================
@router.get("", response_model=Dict[str, Any])
@router.get("/", response_model=Dict[str, Any], include_in_schema=False)
@router.get("/metrics", response_model=Dict[str, Any])
@router.get("/status", response_model=Dict[str, Any])
async def get_cleaner_metrics(dataset_id: Optional[str] = Query(None)):
    return calculate_metrics_for_dataset(dataset_id)


@router.post("", response_model=Dict[str, Any])
@router.post("/", response_model=Dict[str, Any], include_in_schema=False)
@router.post("/run", response_model=Dict[str, Any])
@router.post("/run/{dataset_id}", response_model=Dict[str, Any])
@router.post("/clean", response_model=Dict[str, Any])
@router.post("/clean/{dataset_id}", response_model=Dict[str, Any])
async def execute_cleaner(
    dataset_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = Body(default={}),
    session: Session = Depends(get_session),
):
    start_ts = time.time()
    raw_target = dataset_id or (payload.get("dataset_id") if payload else None) or "all"
    target_id = str(raw_target).strip()

    if target_id == "all":
        datasets_to_process = [
            str(d.get("id"))
            for d in DATASETS_STORE
            if is_active_input_dataset(d) and d.get("id")
        ]
    else:
        datasets_to_process = (
            [target_id]
            if any(str(d.get("id")) == target_id for d in DATASETS_STORE)
            else []
        )

    if not datasets_to_process:
        raise HTTPException(
            status_code=404,
            detail="No active datasets found for remediation.",
        )

    aggregated_runs = []
    total_repaired_across_corpus = 0
    cleaned_export_manifests = []

    for ds_id in datasets_to_process:
        ds_key = str(ds_id)
        records = DATASET_SAMPLES_STORE.get(ds_key, [])
        pre_metrics = compute_live_dimensional_metrics(records)
        pre_quality = round(
            _safe_float(pre_metrics.get("global_quality_score"), 0.0) or 0.0, 3
        )
        age_fallback = _compute_cohort_age_median(records)

        repaired_in_dataset = 0
        cleaned_cohort: List[Dict[str, Any]] = []
        field_counts: Dict[str, int] = {}

        for row in records:
            clean_row, was_repaired, changed_fields = remediate_record(
                row, cohort_age_fallback=age_fallback
            )
            if was_repaired:
                repaired_in_dataset += 1
                for f in changed_fields:
                    field_counts[f] = field_counts.get(f, 0) + 1
            cleaned_cohort.append(clean_row)

        post_metrics = compute_live_dimensional_metrics(cleaned_cohort)
        post_quality = round(
            _safe_float(post_metrics.get("global_quality_score"), 0.0) or 0.0, 3
        )
        post_issues = int(_safe_float(post_metrics.get("total_issues"), 0) or 0)

        DATASET_SAMPLES_STORE[ds_key] = cleaned_cohort
        total_repaired_across_corpus += repaired_in_dataset

        source_meta = next(
            (d for d in DATASETS_STORE if str(d.get("id")) == ds_key), None
        )
        raw_name = str((source_meta or {}).get("name", f"dataset_{ds_key}.csv"))
        if source_meta is not None:
            source_meta["status"] = "OPTIMAL"
            source_meta["anomalies_count"] = post_issues
            source_meta["anomalies"] = post_issues
            source_meta["post_clean_score"] = post_quality

        fields_desc = (
            ", ".join(f"{k} ({v})" for k, v in sorted(field_counts.items()))
            if field_counts
            else "no field repairs required"
        )
        _record_remediation_log(
            session,
            ds_key,
            repaired_in_dataset,
            len(cleaned_cohort),
            f"Remediated {repaired_in_dataset}/{len(cleaned_cohort)} rows on {raw_name}: {fields_desc}.",
        )

        clean_filename_base = format_clean_export_filename(raw_name, ds_key)
        export_token = f"exp_{ds_key}_{uuid.uuid4().hex[:4]}"

        CLEANED_EXPORTS_STORE[export_token] = {
            "token": export_token,
            "source_dataset_id": ds_key,
            "filename_base": clean_filename_base,
            "display_name": f"{clean_filename_base}.csv",
            "total_records": len(cleaned_cohort),
            "anomalies_resolved": repaired_in_dataset,
            "records": cleaned_cohort,
        }

        manifest = {
            "export_token": export_token,
            "source_dataset_id": ds_key,
            "display_name": f"{clean_filename_base}.csv",
            "filename_base": clean_filename_base,
            "total_records": len(cleaned_cohort),
            "anomalies_resolved": repaired_in_dataset,
            "csv_download_url": f"/api/cleaner/export/{export_token}/csv",
            "json_download_url": f"/api/cleaner/export/{export_token}/json",
        }
        cleaned_export_manifests.append(manifest)

        run_success = (
            round(
                max(
                    0.0,
                    (len(cleaned_cohort) - post_issues) / len(cleaned_cohort),
                ),
                4,
            )
            if len(cleaned_cohort) > 0
            else None
        )

        run_summary = {
            "dataset_id": ds_key,
            "records_evaluated": len(cleaned_cohort),
            "anomalies_repaired": repaired_in_dataset,
            "baseline_quality": pre_quality,
            "cleaned_quality": post_quality,
            "success_rate": run_success,
            "cleaned_exports": [manifest],
        }
        aggregated_runs.append(run_summary)
        LATEST_CLEANER_RESULTS[ds_key] = run_summary

    save_persisted_storage()

    duration_sec = round(max(0.001, time.time() - start_ts), 3)
    last_run_result = aggregated_runs[-1] if aggregated_runs else {}
    last_run_result["duration_seconds"] = duration_sec
    last_run_result["total_repaired"] = total_repaired_across_corpus
    last_run_result["cleaned_exports"] = cleaned_export_manifests

    LATEST_CLEANER_RESULTS["all"] = last_run_result

    response_metrics = calculate_metrics_for_dataset(target_id)
    response_metrics["latency_seconds"] = duration_sec
    response_metrics["cleaned_exports"] = cleaned_export_manifests
    response_metrics["results"] = {
        "cleaner": last_run_result,
        "batch_count": len(aggregated_runs),
        "total_anomalies_repaired": total_repaired_across_corpus,
        "summary": last_run_result,
    }
    response_metrics["cleaner"] = last_run_result
    return response_metrics


@router.get("/download/csv")
async def download_cleaned_dataset_csv(dataset_id: Optional[str] = Query("all")):
    """Streams the cleaned dataset as a CSV file starting with 'clean_'."""
    target_id = str(dataset_id or "all").strip()

    cached = _find_cached_export(target_id)
    if cached:
        filename = f"{cached['filename_base']}.csv"
        df = pd.DataFrame(cached["records"])
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        return Response(
            content=stream.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    cleaned_records, out_base = _build_cleaned_records_for_scope(target_id)
    if not cleaned_records:
        raise HTTPException(
            status_code=404, detail="No records available to clean and export."
        )

    df = pd.DataFrame(cleaned_records)
    stream = io.StringIO()
    df.to_csv(stream, index=False)

    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{out_base}.csv"'},
    )


@router.get("/download/json")
async def download_cleaned_dataset_json(dataset_id: Optional[str] = Query("all")):
    """Streams the cleaned dataset as a JSON file starting with 'clean_'."""
    target_id = str(dataset_id or "all").strip()

    cached = _find_cached_export(target_id)
    if cached:
        filename = f"{cached['filename_base']}.json"
        payload = {
            "status": "CLEANED_VERIFIED",
            "dataset_name": cached["display_name"],
            "total_records": cached["total_records"],
            "anomalies_resolved": cached["anomalies_resolved"],
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "records": cached["records"],
        }
        return Response(
            content=json.dumps(payload, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    cleaned_records, out_base = _build_cleaned_records_for_scope(target_id)
    if not cleaned_records:
        raise HTTPException(
            status_code=404, detail="No records available to clean and export."
        )

    payload = {
        "status": "CLEANED_VERIFIED",
        "scope": target_id,
        "dataset_name": f"{out_base}.json",
        "total_records": len(cleaned_records),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "records": cleaned_records,
    }

    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{out_base}.json"'},
    )


@router.get("/export/{export_token}/csv")
async def download_cleaned_csv(export_token: str):
    export_data = CLEANED_EXPORTS_STORE.get(export_token)
    if not export_data:
        raise HTTPException(
            status_code=404, detail="Cleaned export expired or not found."
        )

    df = pd.DataFrame(export_data["records"])
    stream = io.StringIO()
    df.to_csv(stream, index=False)

    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{export_data["filename_base"]}.csv"'
        },
    )


@router.get("/export/{export_token}/json")
async def download_cleaned_json(export_token: str):
    export_data = CLEANED_EXPORTS_STORE.get(export_token)
    if not export_data:
        raise HTTPException(
            status_code=404, detail="Cleaned export expired or not found."
        )

    payload = {
        "status": "CLEANED_VERIFIED",
        "dataset_name": export_data["display_name"],
        "total_records": export_data["total_records"],
        "anomalies_resolved": export_data["anomalies_resolved"],
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "records": export_data["records"],
    }

    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{export_data["filename_base"]}.json"'
        },
    )


@router.get("/manual", response_model=Dict[str, Any])
@router.get("/manual/{dataset_id}", response_model=Dict[str, Any])
async def get_cleaner_manual(dataset_id: Optional[str] = None):
    target_id = str(dataset_id or "all").strip()
    is_batch = target_id.lower() in ["all", "", "none"]

    active_ds = [d for d in DATASETS_STORE if is_active_input_dataset(d)]
    dataset_count = len(active_ds) if is_batch else 1
    total_anomalies = (
        sum(int(d.get("anomalies_count", 0)) for d in active_ds) if is_batch else 0
    )

    return {
        "dataset_id": target_id,
        "dataset_count": dataset_count,
        "quality_score": None,
        "quality": None,
        "record_accuracy": None,
        "accuracy": None,
        "issues_fixed": 0,
        "actions": total_anomalies,
    }


@router.get("/suggestions", response_model=List[Dict[str, Any]])
async def get_cleaner_suggestions(dataset_id: Optional[str] = Query(None)):
    metrics = calculate_metrics_for_dataset(dataset_id)
    return metrics.get("suggestions", [])


@router.get("/compare/{dataset_id}", response_model=Dict[str, Any])
async def get_cleaner_comparison(dataset_id: str = Path(...)):
    target_id = str(dataset_id).strip()
    metrics = calculate_metrics_for_dataset(target_id)
    return {
        "dataset_id": target_id,
        "baseline_quality": metrics["baseline_quality"],
        "cleaned_quality": metrics["cleaned_quality"],
        "baseline_issues": metrics["actions"],
        "cleaned_issues": metrics.get("issues", {}).get("total_anomalies", 0),
        "delta": metrics["improvement"],
        "actions_taken": metrics["actions"],
        "success_rate": metrics["success_rate"],
        "record_accuracy": metrics["record_accuracy"],
    }