"""Staff authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from ..auth import LOGIN_MESSAGE, authenticate, login_limiter, normalise_email
from ..db import get_db
from ..deps import SESSION_USER_KEY, ApiError, current_user, no_content
from ..models import User
from ..schemas import LoginRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_key(request: Request, email: str) -> str:
    client = request.client.host if request.client else "unknown"
    return f"{client}:{email}"


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> User:
    email = normalise_email(payload.email)
    key = _client_key(request, email)
    if not login_limiter.allow(key):
        raise ApiError(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many sign-in attempts. Please wait a minute and try again.",
            headers={"Retry-After": "60"},
        )

    user = authenticate(db, email, payload.password)
    if user is None:
        # One non-enumerating message for both a bad email and a bad password.
        raise ApiError(status.HTTP_401_UNAUTHORIZED, LOGIN_MESSAGE, {"password": LOGIN_MESSAGE})

    login_limiter.reset(key)
    # Rotate the session on privilege change: a fresh cookie for the new identity.
    request.session.clear()
    request.session[SESSION_USER_KEY] = user.id
    return user


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def logout(request: Request) -> Response:
    """Clear the session cookie. Safe to call without an active session."""
    request.session.clear()
    return no_content()
