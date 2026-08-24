# backend/src/utils/paths.py
import os
from typing import Iterable


def project_root() -> str:
    """
    Return the repository project root path.
    Assumes this file lives at backend/src/utils/paths.py and returns the parent of 'backend'.
    """
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def ensure_dir(path: str) -> None:
    """
    Ensure the directory for the given file path exists.
    If `path` looks like a file path, create its parent directory; otherwise create the directory itself.
    """
    if not path:
        return
    # If path looks like a file (has an extension) create parent dir, else create path itself
    dirpath = path if os.path.splitext(path)[1] == "" else os.path.dirname(path)
    if not dirpath:
        return
    os.makedirs(dirpath, exist_ok=True)


def safe_join(base: str, *parts: str) -> str:
    """
    Join path parts to base and normalize. Prevents escaping above base.
    Returns an absolute normalized path.
    """
    joined = os.path.normpath(os.path.join(base, *parts))
    base_norm = os.path.normpath(os.path.abspath(base))
    joined_abs = os.path.abspath(joined)
    if not joined_abs.startswith(base_norm):
        raise ValueError("Attempt to access path outside base directory")
    return joined_abs

