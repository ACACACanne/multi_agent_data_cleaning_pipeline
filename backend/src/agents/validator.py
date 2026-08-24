"""
Validator Agent (Adaptive & Schema-Polymorphic)
Asserts domain-specific clinical invariants across cardiology, oncology, diabetes,
and hemodynamics without imposing foreign schema constraints on distinct datasets.
"""

from typing import Dict, Any, List, Optional, cast
import pandas as pd
from pydantic import BaseModel, model_validator, ValidationError
from sqlmodel import Session, select

from src.models.record import Record


class AdaptiveClinicalContract(BaseModel):
    """
    Polymorphic validation contract that evaluates clinical and mathematical
    invariants dynamically based on the features present in the record.
    """
    class Config:
        extra = "allow"

    @model_validator(mode="after")
    def assert_domain_invariants(self):
        data = self.__dict__

        # 1. Hemodynamic Invariants (systolic_bp & diastolic_bp)
        sbp = data.get("systolic_bp")
        dbp = data.get("diastolic_bp")
        if sbp is not None and dbp is not None:
            try:
                s_val = float(sbp)
                d_val = float(dbp)
                if not (40.0 <= s_val <= 260.0):
                    raise ValueError(f"Systolic BP ({s_val}) is outside physiological limits [40, 260] mmHg.")
                if not (30.0 <= d_val <= 180.0):
                    raise ValueError(f"Diastolic BP ({d_val}) is outside physiological limits [30, 180] mmHg.")
                if s_val <= d_val:
                    raise ValueError(f"Systolic BP ({s_val}) must strictly exceed Diastolic BP ({d_val}).")
                pulse_pressure = s_val - d_val
                if pulse_pressure < 15.0:
                    raise ValueError(f"Pulse pressure ({pulse_pressure:.1f} mmHg) is below clinical minimum of 15 mmHg.")
                map_val = d_val + (pulse_pressure / 3.0)
                if not (50.0 <= map_val <= 140.0):
                    raise ValueError(f"Mean Arterial Pressure ({map_val:.1f} mmHg) outside valid limits [50, 140] mmHg.")
            except (ValueError, TypeError) as num_err:
                raise ValueError(str(num_err))

        # 2. Cardiology Invariants (heart.csv)
        trestbps = data.get("trestbps")
        if trestbps is not None:
            t_val = float(trestbps)
            if not (40.0 <= t_val <= 260.0):
                raise ValueError(f"Resting blood pressure ({t_val}) outside plausible range [40, 260] mmHg.")

        chol = data.get("chol")
        if chol is not None:
            c_val = float(chol)
            if not (80.0 <= c_val <= 600.0):
                raise ValueError(f"Serum cholesterol ({c_val}) outside plausible range [80, 600] mg/dl.")

        thalach = data.get("thalach")
        if thalach is not None:
            th_val = float(thalach)
            if not (50.0 <= th_val <= 250.0):
                raise ValueError(f"Maximum heart rate ({th_val}) outside plausible range [50, 250] bpm.")

        oldpeak = data.get("oldpeak")
        if oldpeak is not None:
            op_val = float(oldpeak)
            if not (0.0 <= op_val <= 10.0):
                raise ValueError(f"ST depression ({op_val}) outside plausible range [0.0, 10.0].")

        # 3. Oncology Morphological Invariants (breast_cancer_diagnostic.csv)
        for morph_col in [
            "radius_mean", "texture_mean", "perimeter_mean", "area_mean",
            "smoothness_mean", "compactness_mean", "concavity_mean",
            "concave_points_mean", "symmetry_mean", "fractal_dimension_mean"
        ]:
            val = data.get(morph_col)
            if val is not None:
                m_val = float(val)
                if m_val <= 0.0:
                    raise ValueError(f"Morphological measurement '{morph_col}' must be strictly positive (got {m_val}).")

        # 4. Diabetes Encounter Invariants (diabetic_data.csv)
        time_hosp = data.get("time_in_hospital")
        if time_hosp is not None:
            th_val = float(time_hosp)
            if not (1.0 <= th_val <= 365.0):
                raise ValueError(f"Hospital stay duration ({th_val}) outside plausible limit [1, 365] days.")

        num_meds = data.get("num_medications")
        if num_meds is not None and float(num_meds) < 0.0:
            raise ValueError(f"Number of medications cannot be negative (got {num_meds}).")

        # 5. Temporal Alignment (admission vs discharge)
        adm = data.get("admission_date")
        dis = data.get("discharge_date")
        if adm and dis:
            if str(adm).strip() > str(dis).strip():
                raise ValueError(f"Admission timestamp ({adm}) occurs chronologically after discharge ({dis}).")

        # 6. Demographic-Pathology Mutual Exclusion
        gender = data.get("gender")
        diag_1 = data.get("diag_1")
        if gender and diag_1:
            g_norm = str(gender).strip().capitalize()
            d_str = str(diag_1).strip()
            female_only_icd = ("640", "641", "642", "643", "650", "V22", "648")
            male_only_icd = ("600", "601", "602", "V10.46")

            if g_norm == "Male" and d_str.startswith(female_only_icd):
                raise ValueError(f"Male patient assigned female-specific ICD diagnosis: {d_str}.")
            if g_norm == "Female" and d_str.startswith(male_only_icd):
                raise ValueError(f"Female patient assigned male-specific ICD diagnosis: {d_str}.")

        # 7. Unimputed Sentinel and Corruption Detection
        for k, v in data.items():
            if k in ["record_id", "_data_status", "data_status"]:
                continue
            v_str = str(v).strip()
            if v is None or v_str in ("?", "nan", "NaN", "None", "NULL", ""):
                raise ValueError(f"Unimputed sentinel or null token detected in column '{k}'.")
            if any(term in v_str.upper() for term in ["CORRUPT", "SYNTHETIC_ANOMALY", "ERROR_CODE", "UNDEFINED"]):
                raise ValueError(f"Corrupted or synthetic error token present in column '{k}': {v}")

        return self


# Backward-compatible alias
ClinicalContract = AdaptiveClinicalContract


def run_validator(dataset_id: Any, session: Session) -> Dict[str, Any]:
    """
    Validator Agent: Asserts adaptive clinical contracts across all dataset records,
    supporting both integer and string dataset identifiers.
    """
    target_id_str = str(dataset_id).strip()
    
    # Query database supporting polymorphic integer / string dataset_id mappings
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
            "agent": "validator",
            "validations_found": 0,
            "passed_count": 0,
            "total_records": 0,
            "quality_score": 1.0,
            "rejection_rate": 0.0,
            "error_traces": [],
            "validations": [],
            "reasoning": f"Validator evaluated 0 records for dataset '{dataset_id}'."
        }

    validations: List[Dict[str, Any]] = []
    error_traces: List[str] = []
    passed_count = 0

    for r in records:
        row_dict = dict(r.data) if isinstance(r.data, dict) else {}
        try:
            AdaptiveClinicalContract(**row_dict)
            passed_count += 1
        except ValidationError as val_err:
            reasons = [f"{e['loc'][0] if e['loc'] else 'contract'}: {e['msg']}" for e in val_err.errors()]
            validations.append({"record_id": r.id, "validations": reasons})
            error_traces.append(f"Record {r.id}: {'; '.join(reasons)}")
        except Exception as generic_err:
            validations.append({"record_id": r.id, "validations": [str(generic_err)]})
            error_traces.append(f"Record {r.id}: {str(generic_err)}")

    total_records = len(records)
    quality_score = float(passed_count / max(1, total_records))
    rejection_rate = float(len(validations) / max(1, total_records))

    return {
        "agent": "validator",
        "validations_found": len(validations),
        "passed_count": passed_count,
        "total_records": total_records,
        "quality_score": round(quality_score, 4),
        "rejection_rate": round(rejection_rate, 4),
        "error_traces": error_traces,
        "validations": validations,
        "reasoning": f"Validator certified {passed_count}/{total_records} records ({quality_score * 100:.1f}% quality score). Flagged {len(validations)} invariant violations."
    }