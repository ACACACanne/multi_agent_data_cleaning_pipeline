# backend/src/check_models.py
"""
Quick import test to reveal runtime import errors.
Run: python backend/src/check_models.py
"""

import sys
import traceback

# Ensure backend/src is on sys.path when running from project root
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

modules = [
    "src.models.agent",
    "src.models.cleaner",
    "src.models.dataset",
    "src.models.evaluation",
    "src.models.experiment",
    "src.models.metrics",
    "src.models.record",
    "src.models.remediation",
    "src.models.schema",
    "src.models.synthetic",
]

print("Testing imports for model modules...")
for m in modules:
    try:
        __import__(m)
        print(f"OK: {m}")
    except Exception as e:
        print(f"ERROR importing {m}: {e}")
        traceback.print_exc()
