# backend/src/storage/remediation_history.py
import os
from typing import Any, Dict, List

from src.utils.file_io import read_json, write_json

BASE_DIR = "backend/storage/remediation"
FILE_PATH = f"{BASE_DIR}/history.json"


def _ensure_dir():
    os.makedirs(BASE_DIR, exist_ok=True)


def get_history() -> List[Dict[str, Any]]:
    _ensure_dir()
    data = read_json(FILE_PATH)
    return data or []


def add_history_entry(entry: Dict[str, Any]):
    _ensure_dir()
    history = get_history()
    history.append(entry)
    write_json(FILE_PATH, history)
    return entry

