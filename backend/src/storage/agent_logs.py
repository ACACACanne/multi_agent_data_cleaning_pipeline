# backend/src/storage/agent_logs.py
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from src.utils.file_io import write_json, read_json

BACKEND_ROOT = Path(__file__).resolve().parents[2]
BASE_DIR = BACKEND_ROOT / "storage" / "agent_logs"


def _ensure_dir():
    os.makedirs(BASE_DIR, exist_ok=True)


def create_agent_log(dataset_id: int, data: Dict[str, Any]):
    _ensure_dir()
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    path = str(BASE_DIR / f"dataset_{dataset_id}_{timestamp}.json")
    write_json(path, data)
    return path, data


def read_agent_log(path: str):
    return read_json(path)

