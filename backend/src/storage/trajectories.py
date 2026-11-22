# backend/src/storage/trajectories.py
import os
from pathlib import Path
from typing import Any, Dict

from src.utils.file_io import read_json, write_json

BACKEND_ROOT = Path(__file__).resolve().parents[2]
BASE_DIR = BACKEND_ROOT / "storage" / "trajectories"


def _path(dataset_id: int) -> str:
    return str(BASE_DIR / f"dataset_{dataset_id}.json")


def _ensure_dir():
    os.makedirs(BASE_DIR, exist_ok=True)


def get_trajectories(dataset_id: int) -> Dict[str, Any]:
    _ensure_dir()
    return read_json(_path(dataset_id)) or {
        "baseline": [],
        "agent": [],
        "manual": [],
    }


def update_trajectories(dataset_id: int, new_data: Dict[str, Any]):
    _ensure_dir()
    write_json(_path(dataset_id), new_data)
    return new_data