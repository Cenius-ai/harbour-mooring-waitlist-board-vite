"""Runtime configuration.

Every value has a working development default, so a bare `uvicorn main:app` on a
fresh checkout boots with no `.env` file present. Secrets use the sanctioned
`cenius-dev-<hex>` fallback pattern; they are development-only values that any
real deployment overrides through the environment.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ - the service root. Used to anchor relative SQLite paths and the
# compiled SPA directory so behaviour does not depend on the caller's cwd.
BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent

SESSION_SECRET_DEV_DEFAULT = "cenius-dev-4b7e1d92c05a8f36"

# Local development browser origins. This is the single place the default lives:
# the container configuration forwards CORS_ORIGINS without repeating it, and any
# real host overrides the value through the environment.
DEVELOPMENT_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:8000,http://127.0.0.1:8000,"
    "http://localhost:4173,http://127.0.0.1:4173"
)


class Settings(BaseSettings):
    """Application settings, tolerant of platform-injected environment keys."""

    # extra="ignore" is required: the runtime injects a superset of standard
    # secret names, and extra="forbid" would crash the boot before serving.
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env", REPO_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Harbour Mooring Waitlist Board"
    environment: str = "development"
    debug: bool = False

    # Signed, HttpOnly session cookie (Starlette SessionMiddleware).
    session_secret: str = SESSION_SECRET_DEV_DEFAULT
    session_cookie_name: str = "harbour_session"
    session_max_age_seconds: int = 60 * 60 * 12

    # Embedded SQLite by default, project-relative. An absolute URL (as used by
    # the docker compose volume at /data) is honoured verbatim.
    database_url: str = "sqlite:///./harbour.db"

    # Seed the demo harbour on the normal boot path when rows are missing.
    seed_on_start: bool = True

    # Comma-separated origins allowed to call the API directly. The SPA itself is
    # same-origin through the dev/preview proxy and through nginx, so this only
    # affects direct API clients.
    cors_origins: str = DEVELOPMENT_ORIGINS

    port: int = 8000

    @field_validator("session_secret", mode="before")
    @classmethod
    def _development_secret_when_blank(cls, value: object) -> object:
        """Treat a blank value the same as an absent one.

        `.env.example` ships `SESSION_SECRET=` so copying it verbatim still
        boots with a working signing key rather than an empty one.
        """
        if value is None or (isinstance(value, str) and not value.strip()):
            return SESSION_SECRET_DEV_DEFAULT
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _development_origins_when_blank(cls, value: object) -> object:
        """A blank CORS_ORIGINS falls back to the local development origins."""
        if value is None or (isinstance(value, str) and not value.strip()):
            return DEVELOPMENT_ORIGINS
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_database_url(self) -> str:
        """Return the database URL with a project-relative SQLite path anchored.

        `sqlite:///./harbour.db` resolves against the backend directory rather
        than the process cwd, so `python3 -m seed` and `uvicorn main:app` both
        touch the same file no matter where they are launched from.
        """
        url = self.database_url
        prefix = "sqlite:///"
        if not url.startswith(prefix):
            return url
        remainder = url[len(prefix) :]
        # `sqlite:////abs/path` (four slashes) is already absolute.
        if remainder.startswith("/"):
            return url
        path = Path(remainder)
        if not path.is_absolute():
            path = (BACKEND_DIR / path).resolve()
        return f"{prefix}{path.as_posix()}"


settings = Settings()
