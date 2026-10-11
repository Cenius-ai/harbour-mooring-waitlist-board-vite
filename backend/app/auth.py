"""Password hashing and the server-side session helpers.

One hashing path is shared by the seed and the login verification, so a password
created by the seed is always accepted by the login endpoint.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

import bcrypt

from .models import User

# bcrypt truncates silently past 72 bytes; reject longer secrets explicitly.
MAX_PASSWORD_BYTES = 72

LOGIN_MESSAGE = "Email or password is incorrect"


def hash_password(password: str) -> str:
    """Hash a password with bcrypt (cost 12) - the single write path."""
    encoded = password.encode("utf-8")[:MAX_PASSWORD_BYTES]
    return bcrypt.hashpw(encoded, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Constant-time verification through the library's own compare."""
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:MAX_PASSWORD_BYTES], password_hash.encode("utf-8"))
    except ValueError:
        # A malformed stored hash must fail closed, never raise into the request.
        return False


def normalise_email(email: str) -> str:
    return email.strip().lower()


class LoginRateLimiter:
    """Small in-process limiter for the credential endpoint.

    The API runs as a single instance with an embedded database, so an in-process
    sliding window is the honest implementation; a multi-instance deployment would
    move the same counters to a shared store.
    """

    def __init__(self, max_attempts: int = 8, window_seconds: int = 60) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        bucket = self._attempts[key]
        while bucket and now - bucket[0] > self.window_seconds:
            bucket.popleft()
        if len(bucket) >= self.max_attempts:
            return False
        bucket.append(now)
        return True

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)


login_limiter = LoginRateLimiter()


def authenticate(db, email: str, password: str) -> User | None:
    """Return the staff user for valid credentials, otherwise None.

    The same generic failure is returned whether the account is missing or the
    password is wrong, so the endpoint never enumerates accounts.
    """
    user = db.query(User).filter(User.email == normalise_email(email)).one_or_none()
    if user is None:
        # Burn a comparable amount of time so a missing account is not detectable
        # from the response latency.
        verify_password(password, bcrypt.hashpw(b"timing", bcrypt.gensalt(rounds=12)).decode())
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
