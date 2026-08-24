# src/export/fhir_converter.py
from __future__ import annotations

import csv
import importlib
import json
import os
import uuid as _uuid
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Mapping

from logging import getLogger

log = getLogger(__name__)

# Try to import fhir.resources; raise a clear error if not installed
try:
    from fhir.resources.patient import Patient  # type: ignore[import]
    from fhir.resources.condition import Condition  # type: ignore[import]
    from fhir.resources.coding import Coding  # type: ignore[import]
    from fhir.resources.codeableconcept import CodeableConcept  # type: ignore[import]
except Exception as exc:  # pragma: no cover - environment dependent
    raise ImportError(
        "fhir.resources package is required by src.export.fhir_converter. "
        "Install with `pip install fhir.resources`."
    ) from exc


def _make_patient_id(name: str) -> str:
    """Deterministic short patient id based on name or random fallback."""
    if not name:
        return f"pat-{_uuid.uuid4().hex[:8]}"
    try:
        return f"pat-{_uuid.uuid5(_uuid.NAMESPACE_DNS, name).hex[:8]}"
    except Exception:
        return f"pat-{_uuid.uuid4().hex[:8]}"


def _make_condition_id(code: str) -> str:
    """Deterministic short condition id based on code string or random fallback."""
    if not code:
        return f"cond-{_uuid.uuid4().hex[:8]}"
    try:
        return f"cond-{_uuid.uuid5(_uuid.NAMESPACE_DNS, code).hex[:8]}"
    except Exception:
        return f"cond-{_uuid.uuid4().hex[:8]}"


def _has_value(value: Any) -> bool:
    """Return True for values that are not missing or blank."""
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    try:
        import math

        if isinstance(value, float) and math.isnan(value):
            return False
    except Exception:
        pass
    return True


def _parse_date(value: Any) -> Optional[str]:
    """Attempt to convert a value into an ISO date string (YYYY-MM-DD)."""
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    raw = str(value).strip()
    if not raw:
        return None
    # Try ISO first
    try:
        parsed = datetime.fromisoformat(raw)
        return parsed.date().isoformat()
    except Exception:
        pass
    # Try common formats
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            parsed = datetime.strptime(raw, fmt)
            return parsed.date().isoformat()
        except Exception:
            continue
    # If nothing matched, return the raw string (caller can decide)
    return raw


def _normalize_gender(value: Any) -> str:
    """Normalize gender values to FHIR expected values when possible."""
    if not _has_value(value):
        return "unknown"
    v = str(value).strip().lower()
    if v in {"m", "male"}:
        return "male"
    if v in {"f", "female"}:
        return "female"
    if v in {"other"}:
        return "other"
    return v  # return as-is for uncommon values


def _split_codes_field(value: Any) -> List[str]:
    """Split a codes field by comma/semicolon and normalize entries."""
    if not _has_value(value):
        return []
    raw = str(value)
    parts = [p.strip() for p in raw.replace(";", ",").split(",")]
    return [p for p in parts if p]


def convert_row_to_fhir(row: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """
    Convert a row mapping into a list of FHIR resource dicts.
    Produces a Patient resource and zero-or-more Condition resources.
    """
    resources: List[Dict[str, Any]] = []

    # Build Patient
    name_val = row.get("name") or row.get("full_name") or ""
    patient_id = _make_patient_id(str(name_val))
    patient = Patient.construct()
    patient.id = patient_id
    patient.resource_type = "Patient"
    patient.active = True

    gender_raw = row.get("gender") or row.get("sex") or ""
    patient.gender = _normalize_gender(gender_raw)

    dob = row.get("dob") or row.get("birthdate") or row.get("birth_date")
    if _has_value(dob):
        birth_date = _parse_date(dob)
        if birth_date:
            patient.birthDate = birth_date

    # Include name as HumanName text if available
    if name_val:
        patient.name = [{"text": str(name_val)}]

    # Optionally include identifiers if present
    identifier = row.get("id") or row.get("patient_id")
    if _has_value(identifier):
        try:
            patient.identifier = [{"value": str(identifier)}]
        except Exception:
            # ignore if fhir model rejects shape; keep patient minimal
            pass

    resources.append(patient.dict())

    # Build Condition(s) from ICD10 or other code columns
    icd10 = row.get("icd10")
    codes_field = row.get("codes")
    codes: List[str] = []
    if _has_value(icd10):
        codes.append(str(icd10).strip())
    codes.extend(_split_codes_field(codes_field))

    for code in codes:
        if not code:
            continue
        condition = Condition.construct()
        condition.id = _make_condition_id(code)
        condition.resource_type = "Condition"
        # subject reference to patient
        condition.subject = {"reference": f"Patient/{patient_id}"}
        # code with coding
        coding = Coding.construct()
        # Use ICD-10 system by default; callers can override if needed
        coding.system = "http://hl7.org/fhir/sid/icd-10"
        coding.code = code
        codeable = CodeableConcept.construct()
        codeable.coding = [coding]
        condition.code = codeable
        resources.append(condition.dict())

    return resources


def run_fhir_conversion(csv_path: str, out_file: str = "final_fhir_payload.json") -> str:
    """
    Read CSV at csv_path, convert each row to FHIR resources and write a Bundle JSON.
    Returns the absolute path to the written output file.

    The output is a FHIR Bundle of type 'transaction' with entries containing resources.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    rows: List[Mapping[str, Any]] = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    bundle: Dict[str, Any] = {"resourceType": "Bundle", "type": "transaction", "entry": []}

    for row in rows:
        try:
            resources = convert_row_to_fhir(row)
        except Exception as exc:
            log.exception("Failed to convert row to FHIR resources: %s", exc)
            continue
        for r in resources:
            # Ensure resourceType exists
            if not r.get("resourceType"):
                # Best-effort inference
                if "subject" in r and "id" in r:
                    r["resourceType"] = "Condition"
                else:
                    r["resourceType"] = "Patient"
            bundle["entry"].append({"resource": r, "request": {"method": "POST", "url": r["resourceType"]}})

    out_dir = os.path.dirname(out_file) or "."
    os.makedirs(out_dir, exist_ok=True)
    abs_out = os.path.abspath(out_file)

    try:
        with open(abs_out, "w", encoding="utf-8") as f:
            json.dump(bundle, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        log.exception("Failed to write FHIR bundle to %s: %s", abs_out, exc)
        raise

    return abs_out


