# src/sandbox/local_executor.py
from __future__ import annotations

import os
import shutil
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..utils.fs import atomic_write
from ..utils.paths import ensure_dir
from ..utils.process import run_subprocess
from ..utils.logging import get_logger

logger = get_logger("sandbox.local_executor")


def _copy_artifacts(src_dir: str, dest_dir: str, exclude: Optional[List[str]] = None) -> List[str]:
    exclude_set = set(exclude or [])
    copied: List[str] = []
    for root, _, files in os.walk(src_dir):
        for fname in files:
            if fname in exclude_set:
                continue
            src = Path(root) / fname
            rel = src.relative_to(src_dir)
            dest = Path(dest_dir) / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(src), str(dest))
            copied.append(str(dest))
    return copied


def exec_in_local_sandbox(
    code: str,
    workdir: str,
    backup_path: Optional[str] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    """
    Execute code in an isolated subprocess using a temporary working directory.
    Copies artifacts back to workdir and restores backup on failure when provided.
    """
    run_id = uuid.uuid4().hex[:8]
    tmp_root = tempfile.mkdtemp(prefix=f"sandbox_local_{run_id}_")
    result: Dict[str, Any] = {
        "run_id": run_id,
        "success": False,
        "exit_code": None,
        "stdout": "",
        "stderr": "",
        "error": "",
        "artifacts_copied": [],
    }

    try:
        # Seed tmp with a copy of workdir
        host_work = Path(tmp_root) / "work"
        host_work.mkdir(parents=True, exist_ok=True)
        if os.path.isdir(workdir):
            shutil.copytree(workdir, host_work, dirs_exist_ok=True)

        script_name = f"sandbox_{run_id}.py"
        script_path = host_work / script_name
        atomic_write(str(script_path), code.encode("utf-8"))

        # Run the script via utils.run_subprocess
        cmd = [str(Path(sys.executable)), str(script_path)]

        proc_res = run_subprocess(cmd, cwd=str(host_work), timeout=timeout, capture_output=True)
        result["exit_code"] = proc_res.get("exit_code")
        result["stdout"] = proc_res.get("stdout", "")
        result["stderr"] = proc_res.get("stderr", "")
        result["success"] = proc_res.get("success", False)

        # Copy back artifacts (exclude the script)
        artifacts = _copy_artifacts(str(host_work), workdir, exclude=[script_name])
        result["artifacts_copied"] = artifacts

        if not result["success"]:
            result["error"] = result.get("stderr") or "subprocess failed"
            if backup_path:
                try:
                    if os.path.exists(backup_path):
                        if os.path.isdir(backup_path):
                            shutil.copytree(backup_path, workdir, dirs_exist_ok=True)
                        else:
                            shutil.copy2(backup_path, workdir)
                        logger.info("Restored backup %s into %s", backup_path, workdir)
                except Exception:
                    logger.exception("Failed to restore backup after failure")
        return result

    except Exception as exc:
        result["error"] = str(exc)
        logger.exception("Unexpected error in local sandbox: %s", exc)
        if backup_path:
            try:
                if os.path.exists(backup_path):
                    if os.path.isdir(backup_path):
                        shutil.copytree(backup_path, workdir, dirs_exist_ok=True)
                    else:
                        shutil.copy2(backup_path, workdir)
            except Exception:
                logger.exception("Failed to restore backup after unexpected error")
        return result

    finally:
        try:
            shutil.rmtree(tmp_root)
        except Exception:
            logger.exception("Failed to remove tmp dir %s", tmp_root)


