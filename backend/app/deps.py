"""Shared FastAPI dependencies: the signed-in staff guard and error envelope."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .db import get_db
from .models import User

SESSION_USER_KEY = "user_id"


class ApiError(HTTPException):
    """An HTTP error carrying a safe message and optional per-field errors."""

    def __init__(
        self,
        status_code: int,
        message: str,
        errors: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message, headers=headers)
        self.message = message
        self.errors = errors or {}


def field_error(field: str, message: str, status_code: int = status.HTTP_422_UNPROCESSABLE_ENTITY) -> ApiError:
    return ApiError(status_code, message, {field: message})


def no_content() -> Response:
    """A bodyless 204 response (FastAPI forbids a response model on 204)."""
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Resolve the signed-in staff member or fail closed with 401 JSON."""
    user_id: Any = request.session.get(SESSION_USER_KEY)
    if user_id is None:
        raise ApiError(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user = db.get(User, int(user_id))
    if user is None:
        request.session.clear()
        raise ApiError(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user
