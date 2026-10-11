"""Pytest fixtures.

The environment is configured *before* the application package is imported, so
the settings object picks up a throwaway SQLite file rather than the developer's
working database. The app's own lifespan hook creates the schema and runs the
idempotent seed, exactly as it does on a real boot.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

TEST_DIR = Path(tempfile.mkdtemp(prefix="harbour-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DIR / 'test.db'}"
os.environ["SESSION_SECRET"] = "cenius-dev-7c41b9e0a2d63f58"
os.environ["SEED_ON_START"] = "true"

DEMO_EMAIL = "cenius@cenius.ai"
DEMO_PASSWORD = "cenius"


@pytest.fixture()
def client():
    """A fresh, cookie-isolated client with the application lifespan running."""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def staff(client):
    """A client already signed in as the documented demo staff account."""
    response = client.post("/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert response.status_code == 200, response.text
    return client


@pytest.fixture()
def bay_id(staff) -> int:
    bays = staff.get("/api/bays").json()
    assert bays, "the seeded harbour must have at least one bay"
    return bays[0]["id"]
