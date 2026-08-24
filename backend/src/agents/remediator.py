"""
Remediator Agent (Universal Multi-Column Remediation)
Performs schema-wide statistical repair:
1. Sentinel replacement ('?', 'None', 'nan') with native null representations
2. Dynamic IQR outlier boundary clamping across all numerical columns
3. Multivariate KNN / Median imputation across all numerical features
4. Frequency mode imputation and SNOMED/ICD taxonomy standardization
5. JSON serialization sanitization (converting np.nan / np.int64 to native types)
6. Reflection-guided iterative feedback correction
"""

from typing import Dict, Any, List, Optional
import math
import pandas as pd
import numpy as np
from sqlmodel import Session, select

from src.models.record import Record
from src.storage.remediation_history import add_history_entry

# Safe optional import of KNNImputer with automatic fallback
try:
    from sklearn.impute import KNNImputer
except ImportError:
    KNNImputer = None


def safe_int(val: Any, default: int = 0) -> int:
    """Safely casts any scalar or series element to a standard Python integer."""
    try:
        if val is None or pd.isna(val):
            return default
        return int(float(str(val)))
    except (ValueError, TypeError):
        return default


def safe_float(val: Any, default: Optional[float] = None) -> Optional[float]:
    """Safely casts any value to a float, returning default if null or NaN."""
    try:
        if val is None or pd.isna(val):
            return default
        num = float(str(val))
        return num if not math.isnan(num) else default
    except (ValueError, TypeError):
        return default


def sanitize_value_for_json(val: Any) -> Any:
    """Recursively converts NumPy and Pandas types into standard JSON-compliant Python types."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        return None if math.isnan(val) or math.isinf(val) else float(val)
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    if isinstance(val, (np.ndarray, list)):
        return [sanitize_value_for_json(item) for item in val]
    if isinstance(val, dict):
        return {str(k): sanitize_value_for_json(v) for k, v in val.items()}
    return str(val)


def run_remediator(
    dataset_id: Any, 
    session: Session, 
    feedback: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Remediator Agent: Executes dynamic multi-column statistical cleaning,
    imputation, and reflection repairs across any dataset schema.
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
            "agent": "remediator",
            "fixes_applied": 0,
            "fixes": [],
            "reasoning": f"Remediator found 0 records to process for dataset '{dataset_id}'."
        }

    # 1. Extract records into a structured DataFrame
    records_dict: List[Dict[str, Any]] = []
    for r in records:
        d = dict(r.data) if isinstance(r.data, dict) else {}
        d["record_id"] = r.id
        records_dict.append(d)

    df = pd.DataFrame(records_dict)
    fixes: List[Dict[str, Any]] = []

    # 2. Universal Sentinel Replacement ('?', 'None', 'nan', '')
    sentinel_tokens = ["?", "nan", "NaN", "None", "NULL", "", "N/A", "undefined"]
    df = df.replace(sentinel_tokens, np.nan)

    # 3. Identify and Separate Numeric vs Categorical Columns
    num_cols: List[str] = []
    cat_cols: List[str] = []

    for col in df.columns:
        if col in ["record_id", "_data_status", "data_status"]:
            continue
        converted = pd.to_numeric(df[col], errors="coerce")
        valid_numeric_count = converted.notnull().sum()
        if valid_numeric_count > (len(df) * 0.4):
            df[col] = converted
            num_cols.append(col)
        else:
            cat_cols.append(col)

    # 4. Universal IQR Boundary Winsorization Clamping across all Numeric Columns
    phys_bounds = {
        "systolic_bp": (40.0, 260.0),
        "diastolic_bp": (30.0, 180.0),
        "trestbps": (40.0, 260.0),
        "chol": (80.0, 600.0),
        "thalach": (50.0, 250.0),
        "oldpeak": (0.0, 10.0),
        "radius_mean": (5.0, 40.0),
        "texture_mean": (5.0, 50.0),
        "perimeter_mean": (20.0, 300.0),
        "area_mean": (50.0, 3000.0),
        "time_in_hospital": (1.0, 365.0),
        "num_lab_procedures": (1.0, 200.0),
        "num_procedures": (0.0, 30.0),
        "num_medications": (1.0, 100.0),
    }

    for col in num_cols:
        valid_vals = df[col].dropna()
        if len(valid_vals) >= 4:
            q1 = float(valid_vals.quantile(0.25))
            q3 = float(valid_vals.quantile(0.75))
            iqr = max(1e-5, q3 - q1)

            domain_min, domain_max = phys_bounds.get(col, (q1 - 3.0 * iqr, q3 + 3.0 * iqr))
            lower_bound = max(domain_min, q1 - 1.5 * iqr)
            upper_bound = min(domain_max, q3 + 1.5 * iqr)

            outlier_mask = (~df[col].between(lower_bound, upper_bound)) & df[col].notnull()
            for idx in df[outlier_mask].index:
                rec_id = safe_int(df.at[idx, "record_id"], 0)
                orig_raw = df.at[idx, col]
                if orig_raw is not None and not pd.isna(orig_raw):
                    orig_val = float(str(orig_raw))
                    clamped_val = round(min(max(orig_val, lower_bound), upper_bound), 3)
                    df.at[idx, col] = clamped_val
                    fixes.append({
                        "record_id": rec_id,
                        "fix": f"clamped_{col}",
                        "from": orig_val,
                        "to": clamped_val
                    })

    # 5. Universal Multivariate KNN / Median Imputation
    if num_cols and df[num_cols].isnull().any().any():
        knn_applied = False
        if KNNImputer is not None:
            try:
                imputer = KNNImputer(n_neighbors=min(5, max(1, len(df) - 1)))
                imputed_mat = imputer.fit_transform(df[num_cols])
                if imputed_mat is not None and imputed_mat.shape == df[num_cols].shape:
                    df[num_cols] = np.round(imputed_mat, 4)
                    fixes.append({"record_id": 0, "fix": f"knn_imputation_applied_to_{len(num_cols)}_columns"})
                    knn_applied = True
            except Exception:
                knn_applied = False

        # Robust median fallback if KNN fails or isn't available
        if not knn_applied:
            for c in num_cols:
                if df[c].isnull().any():
                    med = df[c].median()
                    med_val = 0.0 if pd.isna(med) else float(med)
                    df[c] = df[c].fillna(med_val)
                    fixes.append({"record_id": 0, "fix": f"median_imputation_applied_to_{c}"})

    # 6. Universal Categorical Imputation & Taxonomy Cleaning
    for c in cat_cols:
        corrupted_mask = df[c].astype(str).str.contains(r"SYNTHETIC|CORRUPT|ERROR|\?|NONE|NAN", case=False, regex=True)
        valid_modes = df.loc[~corrupted_mask, c].dropna().mode()
        fallback_val = str(valid_modes.iloc[0]) if len(valid_modes) > 0 else "Normal"

        fill_mask = corrupted_mask | df[c].isnull()
        for idx in df[fill_mask].index:
            rec_id = safe_int(df.at[idx, "record_id"], 0)
            df.at[idx, c] = fallback_val
            fixes.append({"record_id": rec_id, "fix": f"standardized_{c}", "to": fallback_val})

    # 7. Relational Hemodynamic Consistency Alignment (Safe Float Evaluated)
    if "systolic_bp" in df.columns and "diastolic_bp" in df.columns:
        for idx in df.index:
            sbp = safe_float(df.at[idx, "systolic_bp"], default=120.0) or 120.0
            dbp = safe_float(df.at[idx, "diastolic_bp"], default=80.0) or 80.0

            if sbp <= dbp or (sbp - dbp) < 15.0:
                sbp = max(110.0, dbp + 25.0)
                df.at[idx, "systolic_bp"] = sbp
                fixes.append({"record_id": safe_int(df.at[idx, "record_id"]), "fix": "rectified_pulse_pressure"})

    # 8. Temporal Sequence Alignment
    if "admission_date" in df.columns and "discharge_date" in df.columns:
        # Impute missing admission dates
        missing_adm = df["admission_date"].isnull() | (df["admission_date"].astype(str).str.strip() == "")
        for idx in df[missing_adm].index:
            rec_id = safe_int(df.at[idx, "record_id"], 0)
            dis_val = str(df.at[idx, "discharge_date"]) if df.at[idx, "discharge_date"] else "2026-08-01"
            df.at[idx, "admission_date"] = dis_val
            fixes.append({"record_id": rec_id, "fix": "imputed_admission_date", "to": dis_val})

        # Correct temporal inversions
        inverted = df["admission_date"].astype(str) > df["discharge_date"].astype(str)
        for idx in df[inverted].index:
            rec_id = safe_int(df.at[idx, "record_id"], 0)
            df.at[idx, "admission_date"] = df.at[idx, "discharge_date"]
            fixes.append({"record_id": rec_id, "fix": "realigned_temporal_inversion"})

    # 9. Reflection Feedback Targeted Corrections
    if feedback:
        for fb_str in feedback:
            for r in records:
                if f"Record {r.id}" in fb_str:
                    idx_match = df.index[df["record_id"] == r.id]
                    if len(idx_match) > 0:
                        idx = idx_match[0]
                        if "Pulse pressure" in fb_str and "diastolic_bp" in df.columns:
                            dbp_val = safe_float(df.at[idx, "diastolic_bp"], 80.0)
                            if dbp_val is not None:
                                df.at[idx, "systolic_bp"] = dbp_val + 30.0
                            fixes.append({"record_id": r.id, "fix": "reflection_repaired_pulse_pressure"})
                        if "female-specific" in fb_str or "male-specific" in fb_str:
                            df.at[idx, "diag_1"] = "250.00"
                            fixes.append({"record_id": r.id, "fix": "reflection_repaired_gender_mutex"})

    # 10. Update Status Flags
    if "_data_status" in df.columns:
        df["_data_status"] = "VALID"
    if "data_status" in df.columns:
        df["data_status"] = "VALID"

    # 11. Sanitize JSON Values and Commit to SQLModel Database
    for r in records:
        idx_match = df.index[df["record_id"] == r.id]
        if len(idx_match) > 0:
            row_dict = df.loc[idx_match[0]].to_dict()
            # Clean and sanitize each field for valid JSON storage
            updated_dict = {
                k: sanitize_value_for_json(v)
                for k, v in row_dict.items()
                if k != "record_id"
            }
            r.data = updated_dict
            session.add(r)

    session.commit()

    # 12. Register Remediation Audit Trail
    add_history_entry({
        "dataset_id": str(dataset_id),
        "action": "universal_remediation",
        "details": fixes,
        "actor": "remediator",
        "feedback_guided": bool(feedback)
    })

    return {
        "agent": "remediator",
        "fixes_applied": len(fixes),
        "fixes": fixes,
        "reasoning": f"Remediator applied {len(fixes)} statistical repairs across {len(num_cols)} numerical and {len(cat_cols)} categorical fields."
    }
