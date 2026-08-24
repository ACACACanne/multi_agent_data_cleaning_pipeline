# src/utils/env.py
from __future__ import annotations

import os
from typing import Optional

def getenv_bool(key: str, default: bool = False) -> bool:
    """
    Read an environment variable and interpret common truthy values.
    """
    val = os.getenv(key)
    if val is None:
        return default
    return val.lower() in {"1", "true", "yes", "on"}

def load_env_file(path: str) -> None:
    """
    Load a .env file into os.environ (simple parser).
    Lines starting with # are ignored. Existing env vars are not overwritten.
    """
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                os.environ.setdefault(k, v)
    except FileNotFoundError:
        return
