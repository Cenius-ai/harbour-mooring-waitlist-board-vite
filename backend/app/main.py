"""FastAPI application for the Harbour Mooring Waitlist Board.

Boot path (no `.env`, no manual steps): create the SQLite schema, seed the demo
harbour when the database is empty, then serve the JSON API and - when the Vite
build is present - the compiled single-page app from the same origin so the
session cookie stays first-party.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware

from .config import BACKEND_DIR, REPO_DIR, settings
from .db import Base, engine
from .deps import ApiError
from .routers import auth, bays, buoys, inspections, overview, waitlist
from .seed import seed_all

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("harbour.main")


def _spa_directory() -> Path | None:
    """The directory that holds the served single-page app, if one exists."""
    candidates = [
        REPO_DIR / "frontend" / "dist",
        BACKEND_DIR / "static",
    ]
    for candidate in candidates:
        if (candidate / "index.html").is_file():
            return candidate
    return None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    logger.info("database ready at %s", settings.resolved_database_url)
    if settings.seed_on_start:
        seed_all()
    spa = _spa_directory()
    if spa is None:
        logger.warning("no compiled front-end found; serving the API status page at /")
    else:
        logger.info("serving the compiled front-end from %s", spa)
    logger.info("listening on 0.0.0.0:%s", settings.port)
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    session_cookie=settings.session_cookie_name,
    max_age=settings.session_max_age_seconds,
    same_site="lax",
    https_only=False,  # preview and local use serve over plain HTTP
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; "
        "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    )
    return response


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.message, "errors": exc.errors},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Turn Pydantic errors into a per-field message map the forms can render."""
    errors: dict[str, str] = {}
    for error in exc.errors():
        location = [part for part in error.get("loc", ()) if part != "body"]
        field = str(location[-1]) if location else "body"
        message = str(error.get("msg", "Invalid value"))
        message = message.removeprefix("Value error, ")
        errors.setdefault(field, message)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"message": "Please correct the highlighted fields.", "errors": errors},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": detail, "errors": {}},
        headers=getattr(exc, "headers", None),
    )


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health", include_in_schema=False)
def health_alias() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(bays.router)
app.include_router(buoys.router)
app.include_router(waitlist.router)
app.include_router(inspections.router)
app.include_router(overview.router)


@app.api_route(
    "/api/{unknown:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
def api_not_found(unknown: str) -> JSONResponse:
    raise ApiError(status.HTTP_404_NOT_FOUND, f"No API route matches /api/{unknown}")


class SPAStaticFiles(StaticFiles):
    """Serve the compiled SPA, falling back to index.html for client routes."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


_spa_dir = _spa_directory()
if _spa_dir is not None:
    app.mount("/", SPAStaticFiles(directory=str(_spa_dir), html=True), name="spa")
