# src/sandbox/docker_executor.py
from __future__ import annotations

import os
import shutil
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Dict, Any, Optional, List

from ..utils.fs import atomic_write
from ..utils.process import run_subprocess, run_in_container
from ..utils.logging import get_logger

logger = get_logger("sandbox.docker_executor")


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


def run_in_docker(
    code: str,
    workdir: str,
    backup_path: Optional[str] = None,
    image: str = "python:3.11-slim",
    timeout: int = 120,
    docker_cli: str = "docker",
) -> Dict[str, Any]:
    """
    Execute code inside a Docker container when available, otherwise fall back to local subprocess.
    Copies artifacts back to workdir and restores backup on failure when provided.
    """
    run_id = uuid.uuid4().hex[:8]
    tmp_root = tempfile.mkdtemp(prefix=f"docker_exec_{run_id}_")
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
        host_work = Path(tmp_root) / "work"
        host_work.mkdir(parents=True, exist_ok=True)
        if os.path.isdir(workdir):
            shutil.copytree(workdir, host_work, dirs_exist_ok=True)

        script_name = f"remediate_{run_id}.py"
        script_path = host_work / script_name
        atomic_write(str(script_path), code.encode("utf-8"))

        # Try containerized run first
        try:
            container_cmd = [sys.executable, script_name]

            container_res = run_in_container(
                image=image,
                cmd=container_cmd,
                mount_host_dir=str(host_work),
                container_workdir="/work",
                timeout=timeout,
                docker_cli=docker_cli,
            )
            proc_res = container_res
        except Exception:
            # Fallback to local subprocess
            proc_res = run_subprocess([str(Path(sys.executable)), str(script_path)], cwd=str(host_work), timeout=timeout, capture_output=True)

        result["exit_code"] = proc_res.get("exit_code")
        result["stdout"] = proc_res.get("stdout", "")
        result["stderr"] = proc_res.get("stderr", "")
        result["success"] = proc_res.get("success", False)

        artifacts = _copy_artifacts(str(host_work), workdir, exclude=[script_name])
        result["artifacts_copied"] = artifacts

        if not result["success"]:
            result["error"] = result.get("stderr") or "execution failed"
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
        else:
            logger.info("Run succeeded, artifacts copied: %d", len(artifacts))

        return result

    except Exception as exc:
        result["error"] = str(exc)
        logger.exception("Unexpected error in run_in_docker: %s", exc)
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
