# backend/src/storage/schema_drift.py
import os
from typing import Any, Dict

from src.utils.file_io import read_json, write_json

BASE_DIR = "backend/storage/schema_drift"


def _path(dataset_id: int):
    return f"{BASE_DIR}/dataset_{dataset_id}.json"


def _ensure_dir():
    os.makedirs(BASE_DIR, exist_ok=True)


def get_schema_drift(dataset_id: int) -> Dict[str, Any]:
    _ensure_dir()
    return read_json(_path(dataset_id)) or {
        "summary": {},
        "metrics": {},
        "fields": {},
    }


def update_schema_drift(dataset_id: int, report: Dict[str, Any]):
    _ensure_dir()
    write_json(_path(dataset_id), report)
    return report

