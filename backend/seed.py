"""Seed entry point: `python3 -m seed` from the backend directory.

Runs the idempotent seed and exits. It never starts the HTTP server.
"""

from app.seed import main

if __name__ == "__main__":
    main()
