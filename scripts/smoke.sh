#!/usr/bin/env bash
#
# End-to-end smoke test against a RUNNING board.
#
#   bash scripts/smoke.sh                 # defaults to http://127.0.0.1:8000
#   BASE_URL=http://127.0.0.1:5173 bash scripts/smoke.sh
#
# It signs in with the demo staff account, creates a buoy, records an inspection
# against it, reads both back, deletes them again and reports every step. Exits
# non-zero on the first failure.
set -euo pipefail

cd "$(dirname "$0")/.."

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
COOKIE_JAR="$(mktemp)"
STEP=0

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

ok() {
  STEP=$((STEP + 1))
  printf '  [%02d ok] %s\n' "$STEP" "$1"
}

fail() {
  printf '  [FAIL] %s\n' "$1" >&2
  exit 1
}

api() {
  # api METHOD PATH [JSON-BODY]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -fsS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X "$method" "${BASE_URL}${path}" \
      -H 'Content-Type: application/json' -d "$body"
  else
    curl -fsS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X "$method" "${BASE_URL}${path}"
  fi
}

field() {
  python3 -c "import json,sys;print(json.load(sys.stdin)$1)"
}

echo "Harbour Mooring Waitlist Board - smoke test"
echo "Target: ${BASE_URL}"
echo

curl -fsS "${BASE_URL}/api/health" | grep -q '"status":"ok"' || fail "GET /api/health did not return {\"status\":\"ok\"}"
ok "health endpoint answered"

curl -fsS -c "$COOKIE_JAR" -X POST "${BASE_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"cenius@cenius.ai","password":"cenius"}' >/dev/null \
  || fail "sign-in with the demo credentials failed"
ok "signed in as cenius@cenius.ai"

api GET /api/auth/me | grep -q 'cenius@cenius.ai' || fail "/api/auth/me did not return the staff profile"
ok "session cookie accepted by /api/auth/me"

STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/api/buoys")
[ "$STATUS" = "401" ] || fail "GET /api/buoys without a cookie returned ${STATUS}, expected 401"
ok "unauthenticated /api/buoys is refused with 401"

BAY_ID=$(api GET /api/bays | field "[0]['id']")
[ -n "$BAY_ID" ] || fail "no seeded bays were returned"
ok "seeded bay found (id ${BAY_ID})"

CODE="SM-$(( RANDOM % 9000 + 1000 ))"
CREATED=$(api POST /api/buoys "{\"bay_id\":${BAY_ID},\"code\":\"${CODE}\",\"size_class\":\"M\",\"depth_m\":3.2,\"swing_radius_m\":6.0,\"status\":\"available\",\"notes\":\"Created by scripts/smoke.sh\"}")
BUOY_ID=$(printf '%s' "$CREATED" | field "['id']")
[ -n "$BUOY_ID" ] || fail "creating a buoy did not return an id"
ok "created buoy ${CODE} (id ${BUOY_ID})"

api GET "/api/buoys/${BUOY_ID}" | grep -q "\"code\":\"${CODE}\"" || fail "the new buoy could not be read back"
ok "read the new buoy back from the register"

TODAY=$(date +%Y-%m-%d)
INSPECTION=$(api POST /api/inspections "{\"buoy_id\":${BUOY_ID},\"inspected_on\":\"${TODAY}\",\"inspector_name\":\"Smoke Test\",\"chain_wear_percent\":12,\"notes\":\"Recorded by scripts/smoke.sh\"}")
INSPECTION_ID=$(printf '%s' "$INSPECTION" | field "['id']")
[ -n "$INSPECTION_ID" ] || fail "recording an inspection did not return an id"
ok "recorded an annual inspection (id ${INSPECTION_ID})"

DUP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" -X POST "${BASE_URL}/api/inspections" \
  -H 'Content-Type: application/json' \
  -d "{\"buoy_id\":${BUOY_ID},\"inspected_on\":\"${TODAY}\",\"inspector_name\":\"Smoke Test\",\"chain_wear_percent\":20,\"notes\":\"duplicate\"}")
[ "$DUP_STATUS" = "409" ] || fail "the annual guard returned ${DUP_STATUS} for a duplicate year, expected 409"
ok "the annual guard rejected a second inspection in the same year (409)"

api GET "/api/inspections?buoy_id=${BUOY_ID}" | grep -q "\"buoy_id\":${BUOY_ID}" || fail "the inspection was not listed for its buoy"
ok "inspection appears in the ledger for its buoy"

api GET /api/overview | grep -q '"bay_count"' || fail "the overview aggregate did not return counts"
ok "overview aggregate returned counts, overdue and longest-waiting panels"

api DELETE "/api/inspections/${INSPECTION_ID}" >/dev/null
ok "deleted the inspection"

api DELETE "/api/buoys/${BUOY_ID}" >/dev/null
ok "deleted the buoy"

GONE=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" "${BASE_URL}/api/buoys/${BUOY_ID}")
[ "$GONE" = "404" ] || fail "the deleted buoy still returns ${GONE}, expected 404"
ok "the deleted buoy is gone (404)"

# Sign out records the cleared cookie back into the jar, which is what a browser
# does with the Set-Cookie header the server sends.
curl -fsS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "${BASE_URL}/api/auth/logout" >/dev/null || true
AFTER=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" "${BASE_URL}/api/auth/me")
[ "$AFTER" = "401" ] || fail "the session survived sign-out (expected 401, got ${AFTER})"
ok "sign-out cleared the session"

echo
echo "All ${STEP} smoke steps passed."
