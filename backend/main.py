"""Service entry point: `uvicorn main:app --host 0.0.0.0 --port 8000`."""

from app.main import app  # noqa: F401  (re-exported for the ASGI server)

__all__ = ["app"]
