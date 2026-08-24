# backend/src/storage/reasoning.py
import os
from typing import Any, Dict, List

from src.utils.file_io import read_json, write_json

BASE_DIR = "backend/storage/reasoning"


def _path(dataset_id: int):
    return f"{BASE_DIR}/dataset_{dataset_id}.json"


def _ensure_dir():
    os.makedirs(BASE_DIR, exist_ok=True)


def get_reasoning(dataset_id: int) -> List[Dict[str, Any]]:
    _ensure_dir()
    return read_json(_path(dataset_id)) or []


def append_reasoning(dataset_id: int, entry: Dict[str, Any]):
    _ensure_dir()
    timeline = get_reasoning(dataset_id)
    timeline.append(entry)
    write_json(_path(dataset_id), timeline)
    return entry

