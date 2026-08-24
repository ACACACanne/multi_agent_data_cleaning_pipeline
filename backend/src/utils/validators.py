# backend/src/utils/validators.py
from typing import Dict, Any


def validate_dataset_payload(payload: Dict[str, Any]) -> None:
    """
    Validate dataset payload shape.
    Raises ValueError on invalid payload.
    """
    if not isinstance(payload, dict):
        raise ValueError("Dataset payload must be an object.")
    if "name" not in payload or not payload["name"]:
        raise ValueError("Dataset must have a name.")
    # Accept either list or dict for columns depending on API design; support both
    if "columns" not in payload or not isinstance(payload["columns"], (list, dict)):
        raise ValueError("Dataset must define columns as a list or dict.")


def validate_record_payload(payload: Dict[str, Any]) -> None:
    """
    Validate record payload shape.
    Raises ValueError on invalid payload.
    """
    if not isinstance(payload, dict):
        raise ValueError("Record payload must be an object.")
    # Example check: ensure error_types is a list if present
    if "error_types" in payload and not isinstance(payload["error_types"], list):
        raise ValueError("error_types must be a list.")


def validate_synthetic_config(payload: Dict[str, Any]) -> None:
    if not isinstance(payload, dict):
        raise ValueError("Synthetic config must be an object.")
    # Basic sanity checks (expand as needed)
    if "errors" in payload and not isinstance(payload["errors"], list):
        raise ValueError("Synthetic config 'errors' must be a list.")



