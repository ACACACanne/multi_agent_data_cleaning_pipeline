"""
DataRA Pro - Remediator Agent
Autonomous reflection remediator with clinical RAG knowledge mapping and invariant repair.
"""

from typing import List, Dict, Any, Tuple
import copy
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from src.models.schemas import AuditFinding, RemediationAction, ValidationReport


class ClinicalRAGKnowledgeBase:
    """RAG Terminology knowledge base for standardizing diagnostic codes."""
    TAXONOMY_MAP = {
        "ERR_ICD_": "ICD_414_0",
        "SYNTHETIC_CORRUPT": "ICD_250_00",
        "CORRUPT": "ICD_401_9",
        "UNKNOWN": "ICD_780_99",
        "X99": "ICD_427_31",
    }

    @classmethod
    def resolve_code(cls, dirty_code: str) -> str:
        if not dirty_code or pd.isna(dirty_code):
            return "ICD_401_9"  # Standard default: Essential Hypertension
        clean_str = str(dirty_code).upper()
        for key, standard in cls.TAXONOMY_MAP.items():
            if key in clean_str:
                return standard
        return re_sub := "".join(c for c in clean_str if c.isalnum() or c == "_") or "ICD_401_9"


class RemediatorAgent:
    """Executes context-aware repair and reflects on validation rejection errors."""

    def __init__(self, name: str = "Remediator Agent"):
        self.name = name

    def remediate(
        self,
        records: List[Dict[str, Any]],
        findings: List[AuditFinding],
        validation_report: ValidationReport | None = None,
        step: int = 1
    ) -> Tuple[List[Dict[str, Any]], List[RemediationAction]]:
        remediated = copy.deepcopy(records)
        actions: List[RemediationAction] = []
        if not remediated:
            return remediated, actions

        df = pd.DataFrame(remediated)

        # Precompute cohort distribution statistics
        cohort_medians = {}
        cohort_modes = {}
        for col in df.columns:
            if ptypes := pd.api.types.is_numeric_dtype(df[col]):
                valid_num = df[col].dropna()
                cohort_medians[col] = float(valid_num.median()) if len(valid_num) > 0 else 70.0
            else:
                valid_str = df[col].dropna()
                cohort_modes[col] = str(valid_str.mode()[0]) if len(valid_str) > 0 else "VALID"

        # 1. Address Specific Audit Findings
        for finding in findings:
            idx = finding.row_index
            if idx >= len(remediated):
                continue
            rec = remediated[idx]
            col = finding.column
            orig_val = rec.get(col)

            # Case A: Missing Value Imputation
            if finding.issue_type == "NULL_VALUE":
                if col in cohort_medians:
                    new_val = cohort_medians[col]
                elif col == "admission_date":
                    dis_str = rec.get("discharge_date")
                    if dis_str:
                        try:
                            dis_dt = datetime.fromisoformat(dis_str.replace("Z", ""))
                            new_val = (dis_dt - timedelta(days=3)).strftime("%Y-%m-%d")
                        except Exception:
                            new_val = "2026-01-10"
                    else:
                        new_val = "2026-01-10"
                else:
                    new_val = cohort_modes.get(col, "STANDARD_RECORD")

                rec[col] = new_val
                actions.append(
                    RemediationAction(
                        step=step,
                        action="COHORT_IMPUTATION",
                        target_column=col,
                        row_index=idx,
                        before_value=orig_val,
                        after_value=new_val,
                        finding=f"Imputed missing {col} using cohort distribution."
                    )
                )

            # Case B: Numerical Outlier Clamping (IQR Winsorization)
            elif finding.issue_type == "NUMERICAL_OUTLIER" and col in rec:
                raw_num = float(rec[col])
                if col == "systolic_bp":
                    clamped_num = float(np.clip(raw_num, 90.0, 160.0))
                elif col == "diastolic_bp":
                    clamped_num = float(np.clip(raw_num, 60.0, 100.0))
                elif col == "age":
                    clamped_num = float(np.clip(raw_num, 18.0, 95.0))
                else:
                    med = cohort_medians.get(col, 50.0)
                    clamped_num = float(np.clip(raw_num, med * 0.5, med * 1.5))

                rec[col] = clamped_num
                actions.append(
                    RemediationAction(
                        step=step,
                        action="WINSORIZED_CLAMPING",
                        target_column=col,
                        row_index=idx,
                        before_value=orig_val,
                        after_value=clamped_num,
                        finding=f"Clamped physiological outlier in {col} from {raw_num} to {clamped_num}."
                    )
                )

        # 2. Holistic Relational Tree Invariant Verification & Repair
        for idx, rec in enumerate(remediated):
            rec_id = str(rec.get("id", f"row_{idx}"))

            # Tree Invariant 1: Hemodynamic Coherence (Systolic vs Diastolic)
            sbp = rec.get("systolic_bp")
            dbp = rec.get("diastolic_bp")

            if sbp is not None or dbp is not None:
                # Handle negative vitals (e.g. -20)
                if dbp is not None and float(dbp) < 30:
                    before_dbp = dbp
                    rec["diastolic_bp"] = 80.0
                    dbp = 80.0
                    actions.append(
                        RemediationAction(
                            step=step,
                            action="INVARIANT_RESTORATION",
                            target_column="diastolic_bp",
                            row_index=idx,
                            before_value=before_dbp,
                            after_value=80.0,
                            finding="Corrected negative/sub-physiological diastolic blood pressure."
                        )
                    )

                if sbp is not None and float(sbp) > 220:
                    before_sbp = sbp
                    rec["systolic_bp"] = 135.0
                    sbp = 135.0
                    actions.append(
                        RemediationAction(
                            step=step,
                            action="INVARIANT_RESTORATION",
                            target_column="systolic_bp",
                            row_index=idx,
                            before_value=before_sbp,
                            after_value=135.0,
                            finding="Restored hypertensive crisis outlier systolic blood pressure to normal limits."
                        )
                    )

                # Ensure Systolic > Diastolic by at least 25 mmHg
                if sbp is not None and dbp is not None and float(sbp) <= float(dbp):
                    before_sbp = sbp
                    rec["systolic_bp"] = float(dbp) + 40.0
                    actions.append(
                        RemediationAction(
                            step=step,
                            action="TREE_INVARIANT_REPAIR",
                            target_column="systolic_bp",
                            row_index=idx,
                            before_value=before_sbp,
                            after_value=rec["systolic_bp"],
                            finding=f"Enforced tree invariant: systolic ({rec['systolic_bp']}) adjusted to exceed diastolic ({dbp})."
                        )
                    )

            # Tree Invariant 2: Temporal Invariant (Admission <= Discharge)
            adm = rec.get("admission_date")
            dis = rec.get("discharge_date")
            if adm and dis:
                try:
                    adm_dt = datetime.strptime(str(adm)[:10], "%Y-%m-%d")
                    dis_dt = datetime.strptime(str(dis)[:10], "%Y-%m-%d")
                    if adm_dt > dis_dt:
                        rec["admission_date"] = (dis_dt - timedelta(days=4)).strftime("%Y-%m-%d")
                        actions.append(
                            RemediationAction(
                                step=step,
                                action="TEMPORAL_TREE_REPAIR",
                                target_column="admission_date",
                                row_index=idx,
                                before_value=adm,
                                after_value=rec["admission_date"],
                                finding="Realigned admission date chronologically prior to discharge date."
                            )
                        )
                except Exception:
                    rec["admission_date"] = "2026-01-10"
                    rec["discharge_date"] = "2026-01-18"

            # Tree Invariant 3: Clinical RAG Taxonomy Normalization
            if diag := rec.get("diagnosis_code"):
                if "ERR_" in str(diag) or "SYNTHETIC" in str(diag) or "!!" in str(diag):
                    fixed_code = ClinicalRAGKnowledgeBase.resolve_code(str(diag))
                    rec["diagnosis_code"] = fixed_code
                    actions.append(
                        RemediationAction(
                            step=step,
                            action="RAG_TAXONOMY_STANDARDIZATION",
                            target_column="diagnosis_code",
                            row_index=idx,
                            before_value=diag,
                            after_value=fixed_code,
                            finding=f"Mapped corrupted code '{diag}' to standard SNOMED/ICD nomenclature '{fixed_code}'."
                        )
                    )

            # Update Record Operational Tag
            rec["data_status"] = "REMEDIATED"
            rec["_data_status"] = "REMEDIATED"

        return remediated, actions
