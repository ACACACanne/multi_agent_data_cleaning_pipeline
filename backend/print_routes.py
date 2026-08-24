# -- backend/print_routes.py
from app import app

for r in app.routes:
    methods = list(getattr(r, "methods", [])) or []
    name = getattr(r, "name", "")
    endpoint = getattr(r, "endpoint", None)
    module = getattr(endpoint, "__module__", "") if endpoint else ""
    # Some route implementations may not have a typed 'path' attribute
    path = getattr(r, "path", None) or getattr(r, "path_format", None) or getattr(r, "uri", "")
    print(f"{path:40} {methods:20} name={name:30} module={module}")

