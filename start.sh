#!/usr/bin/env bash
#
# Harbour Mooring Waitlist Board - the delivered start command.
#
# Brings up BOTH halves of the split app and stays in the foreground:
#   * the FastAPI service on 0.0.0.0:8000 (JSON API, and the compiled SPA when
#     it is present, so the API port is a complete app on its own)
#   * the Vite front-end server on 0.0.0.0:5173, proxying /api to the API
#
# It installs nothing. Run install.sh first.
set -euo pipefail

cd "$(dirname "$0")"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"
API_HOST_FOR_WEB="${API_HOST_FOR_WEB:-127.0.0.1}"

if [ ! -f frontend/dist/index.html ]; then
  echo "==> Front-end bundle missing; building it now"
  if ! npm --prefix frontend install --no-audit --no-fund; then
    echo "WARNING: npm install failed - the API will still serve its status page." >&2
  fi
  if ! npm --prefix frontend run build; then
    echo "WARNING: front-end build failed - the API will still serve its status page." >&2
  fi
fi

echo "==> Starting the API on 0.0.0.0:${API_PORT}"
(
  cd backend
  exec uvicorn main:app --host 0.0.0.0 --port "${API_PORT}"
) &
API_PID=$!

cleanup() {
  if kill -0 "${API_PID}" 2>/dev/null; then
    kill "${API_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "==> Waiting for the API to answer on 127.0.0.1:${API_PORT}"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
    echo "==> API is up"
    break
  fi
  sleep 1
done

echo "==> Starting the web tier on 0.0.0.0:${WEB_PORT} (proxying /api to ${API_HOST_FOR_WEB}:${API_PORT})"
echo "==> The board is at http://localhost:${WEB_PORT} - demo sign-in cenius@cenius.ai / cenius"

cd frontend
VITE_API_TARGET="http://${API_HOST_FOR_WEB}:${API_PORT}" \
  npm run serve -- --host 0.0.0.0 --port "${WEB_PORT}" --strictPort
