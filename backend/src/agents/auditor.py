"""
Auditor Agent (Schema-Agnostic Clinical Anomaly Detector)
Discovers missing values, sentinel tokens, statistical IQR outliers,
and corrupted taxonomy across all columns in any clinical dataset.
"""

from typing import Dict, Any, List
import pandas as pd
import numpy as np
from sqlmodel import Session, select

from src.models.record import Record


def run_auditor(dataset_id: Any, session: Session) -> Dict[str, Any]:
    """
    Auditor Agent: Scans any dataset schema for missing observations,
    multivariate IQR statistical outliers, and temporal sequence inversions.
    """
    target_id_str = str(dataset_id).strip()

    if target_id_str.isdigit():
        records = session.exec(
            select(Record).where(Record.dataset_id == int(target_id_str))
        ).all()
    else:
        records = session.exec(
            select(Record).where(str(Record.dataset_id) == target_id_str)
        ).all()

    if not records:
        return {
            "agent": "auditor",
            "issues_found": 0,
            "issues": [],
            "anomalies": [],
            "reasoning": f"Auditor scanned 0 records for dataset '{dataset_id}'."
        }

    # 1. Safely extract dictionary records
    raw_data: List[Dict[str, Any]] = []
    for r in records:
        row_dict = dict(r.data) if isinstance(r.data, dict) else {}
        row_dict["record_id"] = r.id
        raw_data.append(row_dict)

    df = pd.DataFrame(raw_data)
    issues: List[Dict[str, Any]] = []

    # 2. Universal Missing Value & Sentinel String Detection
    sentinel_set = {"", "?", "nan", "NaN", "None", "NULL", "N/A", "undefined"}
    for r in records:
        row_issues = {}
        data_dict = r.data if isinstance(r.data, dict) else {}
        for key, value in data_dict.items():
            if key == "record_id":
                continue
            if value is None or str(value).strip() in sentinel_set:
                row_issues[key] = "missing_or_sentinel_value"
        if row_issues:
            issues.append({"record_id": r.id, "issues": row_issues})

    # 3. Universal Multi-Column Numerical IQR Outlier Scan
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    for col in df.columns:
        if col not in num_cols and col not in ["record_id", "_data_status", "data_status"]:
            converted = pd.to_numeric(df[col], errors="coerce")
            if converted.notnull().sum() > len(df) * 0.5:
                df[col] = converted
                num_cols.append(col)

    for col in num_cols:
        if col == "record_id":
            continue
        nums = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(nums) >= 4:
            q1 = float(nums.quantile(0.25))
            q3 = float(nums.quantile(0.75))
            iqr = max(1e-5, q3 - q1)
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr

            outlier_mask = (~df[col].between(lower_bound, upper_bound)) & df[col].notnull()
            for _, o_row in df[outlier_mask].iterrows():
                issues.append({
                    "record_id": o_row["record_id"],
                    "issues": {col: f"statistical_outlier ({o_row[col]} outside [{lower_bound:.2f}, {upper_bound:.2f}])"}
                })

    # 4. Temporal Sequence Inversions
    if "admission_date" in df.columns and "discharge_date" in df.columns:
        inv_mask = (
            df["admission_date"].notnull() & 
            df["discharge_date"].notnull() & 
            (df["admission_date"].astype(str) > df["discharge_date"].astype(str))
        )
        for _, inv in df[inv_mask].iterrows():
            issues.append({
                "record_id": inv["record_id"],
                "issues": {"temporal_inversion": f"admission ({inv['admission_date']}) > discharge ({inv['discharge_date']})"}
            })

    # 5. Corrupted Clinical Taxonomy / Synthetic Anomaly Flags
    for col in df.columns:
        if col == "record_id":
            continue
        corrupt_mask = df[col].astype(str).str.contains(r"SYNTHETIC|CORRUPT|ERROR_CODE", case=False, regex=True)
        for _, c_row in df[corrupt_mask].iterrows():
            issues.append({
                "record_id": c_row["record_id"],
                "issues": {col: f"corrupted_taxonomy_token ({c_row[col]})"}
            })

    return {
        "agent": "auditor",
        "issues_found": len(issues),
        "issues": issues,
        "anomalies": issues,
        "reasoning": f"Auditor scanned {len(records)} records across {len(df.columns)} dimensions; identified {len(issues)} statistical anomalies and missing fields."
    }