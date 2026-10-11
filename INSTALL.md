# Installation

This is the source of truth for getting the Harbour Mooring Waitlist Board running.
There are two ways to run it: **natively** (the path `install.sh` and `start.sh`
take) or **with Docker Compose** (the deploy layout in `docker-compose.yml`).

There is one package manager per half of the app — **pip** for the Python service
(`backend/requirements.txt`) and **npm** for the React app
(`frontend/package-lock.json`). Do not substitute another one; the lockfile and the
pinned requirements are the reproducible install.

---

## Prerequisites

Install these yourself first. `install.sh` never installs a system package and never
uses `sudo`.

| Requirement | Version | Why |
| --- | --- | --- |
| Python | 3.11 or newer (3.12 recommended) | the FastAPI service |
| pip | bundled with Python | installs `backend/requirements.txt` |
| Node.js | 18 or newer (20 LTS recommended) | builds the React app |
| npm | bundled with Node | installs `frontend/package.json` |
| SQLite | any (bundled with Python via `sqlite3`) | the embedded database; no server to run |

Optional, only for the container path: Docker Engine 24+ with the Compose v2 plugin.

Build tooling note: the SQLite driver is Python's bundled `sqlite3` module, so no
`libsqlite3-dev` or database server is required. Everything is CPU-only and the
front-end fonts ship inside the npm packages (`@fontsource/*`), so nothing is
downloaded at runtime.

---

## Native install (recommended)

### Step 1 — install dependencies, build the front end, create and seed the database

```bash
bash install.sh
```

This single command, run from the repository root:

1. upgrades `pip`, `setuptools` and `wheel`, then installs `backend/requirements.txt`;
2. runs `npm install` in `frontend/` (from `package-lock.json`);
3. runs `npm run build` in `frontend/` (`tsc --noEmit && vite build`) producing `frontend/dist`;
4. writes `.env` with a freshly generated `SESSION_SECRET` if no `.env` exists yet;
5. runs `python3 -m seed` from `backend/`, creating the SQLite schema and the demo
   harbour (staff accounts, 4 bays, 14 buoys, 12 waitlist entries, 9 inspections);
6. checks that the API package imports cleanly.

It **exits** when it is done — it never starts a server.

### Step 2 — start the app

```bash
bash start.sh
```

`start.sh` brings up **both** services and stays in the foreground:

* the FastAPI service on `0.0.0.0:8000` (override with `API_PORT`), which also
  serves the compiled single-page app when `frontend/dist` exists;
* the Vite front-end server on `0.0.0.0:5173` (override with `WEB_PORT`), proxying
  `/api` to the API.

Open **http://localhost:5173**.

### Step 3 — sign in

Use the seeded demo account:

| Email | Password |
| --- | --- |
| `cenius@cenius.ai` | `cenius` |

The hint is printed on the sign-in card as well.

---

## Running each half on its own

Each service boots alone with its own standard command, which is what the split
runner probes.

```bash
# API only - port 8000 (also serves frontend/dist at "/")
cd backend
uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"

# Front end only - port 5173, proxying /api to http://127.0.0.1:8000
cd frontend
VITE_API_TARGET=http://127.0.0.1:8000 npm run serve -- --host 0.0.0.0 --port 5173
```

For front-end development with hot reload, use `npm run dev` instead of `npm run serve`.

### Seed on its own

```bash
(cd backend && python3 -m seed)
```

The seed is idempotent and exits; running it twice creates nothing the second time.

---

## Docker Compose

```bash
docker compose up --build
```

* `api` — built from `backend/Dockerfile` (python:3.12-slim + uvicorn), SQLite at
  `/data/harbour.db` on the named volume `harbour-mooring-board-data` so staff edits
  survive a restart. Health check: `GET /api/health`.
* `web` — built from `frontend/Dockerfile` (Node build stage, then nginx:alpine),
  serving `frontend/dist` and reverse-proxying `/api` to `api:8000`.

Ports: **5173** → the board, **8000** → the API. `docker compose config --services`
prints exactly `api` and `web`.

Images must be pulled once; after that the stack needs no outbound network.

---

## Configuration

`cp .env.example .env` and edit as needed — that copy boots with zero changes,
because every value has an in-code default. The app also boots with **no `.env`
at all**. See the table in [README.md](README.md#configuration).

---

## Tests

```bash
cd backend && python3 -m pytest          # 31 API tests, no network required
BASE_URL=http://127.0.0.1:8000 bash scripts/smoke.sh   # against a running board
```

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `error: externally-managed-environment` from pip | Your distribution marks the system interpreter as PEP 668 managed. `install.sh` already exports `PIP_BREAK_SYSTEM_PACKAGES=1`; if you install by hand, use `pip3 install --break-system-packages -r backend/requirements.txt` or a virtualenv. |
| `sh: 1: vite: not found` | `npm install` has not run in `frontend/`. Run `bash install.sh` (or `npm --prefix frontend install`). |
| The board loads but shows the API status page | `frontend/dist` is missing. Run `npm --prefix frontend run build`. |
| `Address already in use` | A previous server is still bound. Stop it, or start with `API_PORT=8001 bash start.sh`. |
| Sign-in says the password is wrong | The database was seeded by a different build. Delete `backend/harbour.db*`, then run `(cd backend && python3 -m seed)`. |
| Requests to `/api` return HTML instead of JSON | You are hitting the front-end port with a path the API does not own; use `http://localhost:8000/api/...` directly. |
