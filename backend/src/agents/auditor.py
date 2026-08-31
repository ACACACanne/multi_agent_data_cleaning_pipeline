"""
DataRA Pro - Auditor Agent
Performs multi-dimensional data quality auditing and schema invariant verification.
"""

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from pydantic import ValidationError

from src.models.agent import AuditFinding
from src.models.record import ClinicalRecordModel


class AuditorAgent:
    """Audits dataset records against clinical invariant rules, statistical bounds, and schema contracts."""

    def __init__(self, name: str = "Auditor Agent"):
        self.name = name

    def audit_records(self, records: List[Dict[str, Any]]) -> List[AuditFinding]:
        findings: List[AuditFinding] = []
        if not records:
            return findings

        # 1. Missing Values & Structural Null Auditing
        for idx, row_dict in enumerate(records):
            rec_id = str(row_dict.get("id") or row_dict.get("encounter_id") or f"row_{idx}")

            for col, val in row_dict.items():
                if str(col).startswith("_"):
                    continue
                if pd.isna(val) or val is None or str(val).strip().lower() in ["", "?", "nan", "null", "none"]:
                    findings.append(
                        AuditFinding(
                            row_index=idx,
                            record_id=rec_id,
                            column=str(col),
                            issue_type="NULL_VALUE",
                            current_value=val,
                            message=f"Missing or sentinel null value detected in column '{col}'.",
                            severity="HIGH" if col in ["id", "patient_id", "patient_nbr", "admission_date"] else "MEDIUM",
                        )
                    )

        # 2. Pydantic Contract & Invariant Violations
        for idx, row_dict in enumerate(records):
            rec_id = str(row_dict.get("id") or row_dict.get("encounter_id") or f"row_{idx}")
            clean_dict = {k: v for k, v in row_dict.items() if not pd.isna(v)}

            model_payload = {
                "id": rec_id,
                "patient_id": str(clean_dict.get("patient_id") or clean_dict.get("patient_nbr") or "PT_UNKNOWN"),
                "age": clean_dict.get("age") if isinstance(clean_dict.get("age"), (int, float)) else None,
                "systolic_bp": clean_dict.get("systolic_bp") if isinstance(clean_dict.get("systolic_bp"), (int, float)) else None,
                "diastolic_bp": clean_dict.get("diastolic_bp") if isinstance(clean_dict.get("diastolic_bp"), (int, float)) else None,
                "admission_date": str(clean_dict.get("admission_date")) if clean_dict.get("admission_date") else None,
                "discharge_date": str(clean_dict.get("discharge_date")) if clean_dict.get("discharge_date") else None,
                "diagnosis_code": str(clean_dict.get("diagnosis_code") or clean_dict.get("diag_1")) if (clean_dict.get("diagnosis_code") or clean_dict.get("diag_1")) else None,
                "data_status": str(clean_dict.get("data_status") or clean_dict.get("_data_status") or "VALID"),
            }

            try:
                ClinicalRecordModel(**model_payload)
            except (ValidationError, ValueError) as e:
                err_msg = str(e)
                findings.append(
                    AuditFinding(
                        row_index=idx,
                        record_id=rec_id,
                        column="contract_assertion",
                        issue_type="INVARIANT_VIOLATION",
                        current_value=clean_dict,
                        message=f"Invariant contract violation on record {rec_id}: {err_msg}",
                        severity="CRITICAL",
                    )
                )

        # 3. Statistical Numerical Outliers (IQR Method)
        df = pd.DataFrame(records)
        numeric_cols = df.select_dtypes(include=[np.number]).columns

        for col in numeric_cols:
            col_name = str(col)
            if col_name.startswith("_"):
                continue

            series = df[col_name].dropna()
            if len(series) >= 4:
                q25 = float(np.percentile(series, 25))
                q75 = float(np.percentile(series, 75))
                iqr = q75 - q25
                lower_bound = q25 - 2.5 * iqr
                upper_bound = q75 + 2.5 * iqr

                for idx, row in enumerate(records):
                    val = row.get(col_name)
                    if isinstance(val, (int, float)) and not pd.isna(val):
                        val_float = float(val)
                        if val_float < lower_bound or val_float > upper_bound:
                            rec_id = str(row.get("id") or row.get("encounter_id") or f"row_{idx}")
                            findings.append(
                                AuditFinding(
                                    row_index=idx,
                                    record_id=rec_id,
                                    column=col_name,
                                    issue_type="NUMERICAL_OUTLIER",
                                    current_value=val_float,
                                    message=f"Value {val_float} in '{col_name}' violates statistical cohort bounds [{round(lower_bound, 1)}, {round(upper_bound, 1)}].",
                                    severity="MEDIUM",
                                )
                            )

        return findings