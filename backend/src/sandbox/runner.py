#backend/src/sandbox/runner.py
import subprocess, tempfile, os, shutil, sys
from src.logging_config import logger

def run_in_docker(code: str, workdir: str, backup_path: str):
    tmp_script = os.path.join(tempfile.gettempdir(), f"remediate_script_{os.getpid()}.py")
    with open(tmp_script, "w", encoding="utf-8") as f:
        f.write(code)
    try:
        result = subprocess.run([sys.executable, tmp_script], capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            logger.error(result.stderr)
            if os.path.exists(backup_path):
                shutil.copy(backup_path, workdir)
            return {"success": False, "error": result.stderr}
        return {"success": True, "error": ""}
    except Exception as e:
        logger.error(str(e))
        if os.path.exists(backup_path):
            shutil.copy(backup_path, workdir)
        return {"success": False, "error": str(e)}
    finally:
        try:
            os.remove(tmp_script)
        except Exception:
            pass

