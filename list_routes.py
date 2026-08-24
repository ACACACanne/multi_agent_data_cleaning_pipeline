#root/list_routes.py
# list_routes.py (place in project root)
from importlib import import_module
# import the app object from backend.src.app
from backend.src.app import app

for r in app.routes:
    methods = getattr(r, "methods", None)
    # some route classes don't expose `path`; fall back to other attrs or str()
    path = getattr(r, "path", None) or getattr(r, "name", None) or getattr(r, "pattern", None) or str(r)
    print(path, methods)
