"""End-to-end API tests: auth, the buoy register, the waitlist, inspections and
the overview aggregate - the whole primary CRUD path over real persisted rows."""

from __future__ import annotations

from datetime import date, timedelta

from .conftest import DEMO_EMAIL, DEMO_PASSWORD

PROTECTED_GETS = ["/api/bays", "/api/buoys", "/api/waitlist", "/api/inspections", "/api/overview"]


# --------------------------------------------------------------------------- #
# Health and auth
# --------------------------------------------------------------------------- #
def test_health_is_public(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_serves_html(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Harbour" in response.text


def test_login_sets_a_session_cookie_and_me_returns_the_staff_user(client):
    response = client.post(
        "/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == DEMO_EMAIL
    assert body["username"] == "cenius"
    assert "harbour_session" in response.cookies

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == DEMO_EMAIL


def test_login_is_case_insensitive_on_the_email(client):
    response = client.post(
        "/api/auth/login", json={"email": "Cenius@Cenius.AI", "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200


def test_wrong_password_returns_one_generic_message(client):
    response = client.post(
        "/api/auth/login", json={"email": DEMO_EMAIL, "password": "not-the-password"}
    )
    assert response.status_code == 401
    assert response.json()["message"] == "Email or password is incorrect"


def test_unknown_email_returns_the_same_generic_message(client):
    response = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "cenius"}
    )
    assert response.status_code == 401
    assert response.json()["message"] == "Email or password is incorrect"


def test_malformed_email_is_a_field_error(client):
    response = client.post("/api/auth/login", json={"email": "not-an-email", "password": "cenius"})
    assert response.status_code == 422
    assert "email" in response.json()["errors"]


def test_protected_routes_reject_anonymous_callers(client):
    for path in PROTECTED_GETS:
        assert client.get(path).status_code == 401, path


def test_logout_clears_the_session(staff):
    assert staff.get("/api/auth/me").status_code == 200
    assert staff.post("/api/auth/logout").status_code == 204
    assert staff.get("/api/auth/me").status_code == 401


# --------------------------------------------------------------------------- #
# Seeded demo harbour
# --------------------------------------------------------------------------- #
def test_seed_fills_every_register(staff):
    bays = staff.get("/api/bays").json()
    buoys = staff.get("/api/buoys").json()
    waitlist = staff.get("/api/waitlist").json()
    inspections = staff.get("/api/inspections").json()

    assert len(bays) == 4
    assert len(buoys) >= 12
    assert len(waitlist) == 12
    assert len(inspections) == 9

    # Depths and swing radii are real metre figures, never zero placeholders.
    assert all(buoy["depth_m"] > 0 for buoy in buoys)
    assert all(buoy["swing_radius_m"] > 0 for buoy in buoys)
    assert {buoy["size_class"] for buoy in buoys} == {"S", "M", "L"}

    # The inspection ledger spans at least two calendar years.
    assert len({row["inspected_on"][:4] for row in inspections}) >= 2
    assert len({row["chain_wear_percent"] for row in inspections}) > 3

    # Joining dates are distinct and in the past.
    joined = [row["joined_on"] for row in waitlist]
    assert len(set(joined)) == len(joined)
    assert all(row["joined_on"] <= date.today().isoformat() for row in waitlist)


def test_bay_counts_are_computed_not_stored(staff):
    bay = staff.get("/api/bays").json()[0]
    buoys = staff.get(f"/api/buoys?bay_id={bay['id']}").json()
    assert bay["buoy_count"] == len(buoys)


# --------------------------------------------------------------------------- #
# Buoy register
# --------------------------------------------------------------------------- #
def test_buoy_filters_apply(staff):
    medium_available = staff.get("/api/buoys?size_class=M&status=available").json()
    assert medium_available, "the seed must include an available M mooring"
    assert all(b["size_class"] == "M" and b["status"] == "available" for b in medium_available)

    searched = staff.get("/api/buoys?q=NB-").json()
    assert searched
    assert all(b["code"].startswith("NB-") for b in searched)


def test_create_buoy_then_read_it_back(staff, bay_id):
    payload = {
        "bay_id": bay_id,
        "code": "zz-07",
        "size_class": "M",
        "depth_m": 3.4,
        "swing_radius_m": 6.0,
        "status": "available",
        "notes": "Added by the automated check.",
    }
    created = staff.post("/api/buoys", json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["code"] == "ZZ-07"  # codes are normalised to upper case
    assert body["depth_m"] == 3.4

    fetched = staff.get(f"/api/buoys/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["bay_name"]

    assert staff.delete(f"/api/buoys/{body['id']}").status_code == 204
    assert staff.get(f"/api/buoys/{body['id']}").status_code == 404


def test_duplicate_buoy_code_is_a_field_error(staff, bay_id):
    existing = staff.get("/api/buoys").json()[0]["code"]
    response = staff.post(
        "/api/buoys",
        json={
            "bay_id": bay_id,
            "code": existing,
            "size_class": "S",
            "depth_m": 2.0,
            "swing_radius_m": 4.0,
            "status": "available",
            "notes": "",
        },
    )
    assert response.status_code == 409
    assert response.json()["errors"]["code"] == "Buoy code already exists"


def test_depth_and_missing_bay_are_rejected_per_field(staff):
    zero_depth = staff.post(
        "/api/buoys",
        json={
            "bay_id": 1,
            "code": "ZZ-01",
            "size_class": "S",
            "depth_m": 0,
            "swing_radius_m": 4.0,
            "status": "available",
            "notes": "",
        },
    )
    assert zero_depth.status_code == 422
    assert "depth_m" in zero_depth.json()["errors"]

    unknown_bay = staff.post(
        "/api/buoys",
        json={
            "bay_id": 99999,
            "code": "ZZ-02",
            "size_class": "S",
            "depth_m": 2.5,
            "swing_radius_m": 4.0,
            "status": "available",
            "notes": "",
        },
    )
    assert unknown_bay.status_code == 422
    assert "bay_id" in unknown_bay.json()["errors"]


def test_unknown_buoy_id_is_a_404_not_a_crash(staff):
    response = staff.get("/api/buoys/999999")
    assert response.status_code == 404
    assert response.json()["message"] == "Buoy not found"


def test_edit_buoy_status_persists(staff, bay_id):
    created = staff.post(
        "/api/buoys",
        json={
            "bay_id": bay_id,
            "code": "ZZ-09",
            "size_class": "L",
            "depth_m": 4.0,
            "swing_radius_m": 8.0,
            "status": "available",
            "notes": "",
        },
    ).json()

    patched = staff.patch(f"/api/buoys/{created['id']}", json={"status": "maintenance"})
    assert patched.status_code == 200
    assert patched.json()["status"] == "maintenance"
    assert staff.get(f"/api/buoys/{created['id']}").json()["status"] == "maintenance"

    staff.delete(f"/api/buoys/{created['id']}")


def test_deleting_a_buoy_removes_its_inspections(staff, bay_id):
    buoy = staff.post(
        "/api/buoys",
        json={
            "bay_id": bay_id,
            "code": "ZZ-11",
            "size_class": "M",
            "depth_m": 3.0,
            "swing_radius_m": 5.0,
            "status": "available",
            "notes": "",
        },
    ).json()

    inspection = staff.post(
        "/api/inspections",
        json={
            "buoy_id": buoy["id"],
            "inspected_on": date.today().isoformat(),
            "inspector_name": "T. Halford",
            "chain_wear_percent": 12,
            "notes": "First survey.",
        },
    )
    assert inspection.status_code == 201, inspection.text
    inspection_id = inspection.json()["id"]

    assert staff.delete(f"/api/buoys/{buoy['id']}").status_code == 204
    assert staff.get(f"/api/buoys/{buoy['id']}").status_code == 404
    remaining = {row["id"] for row in staff.get("/api/inspections").json()}
    assert inspection_id not in remaining


# --------------------------------------------------------------------------- #
# Waitlist
# --------------------------------------------------------------------------- #
def test_waitlist_positions_are_ordered_within_the_size_class(staff):
    rows = staff.get("/api/waitlist?size_class=M&status=waiting").json()
    assert len(rows) >= 3
    assert [row["position"] for row in rows] == list(range(1, len(rows) + 1))
    dates = [row["joined_on"] for row in rows]
    assert dates == sorted(dates)
    assert all(row["days_waiting"] >= 0 for row in rows)


def test_create_waitlist_entry_takes_its_date_ordered_position(staff):
    joined_on = (date.today() - timedelta(days=1)).isoformat()
    created = staff.post(
        "/api/waitlist",
        json={
            "owner_name": "Ada Bell",
            "owner_email": "ada.bell@example.com",
            "owner_phone": "07700 900555",
            "boat_name": "Petrel",
            "boat_length_m": 12.9,
            "size_class": "L",
            "joined_on": joined_on,
            "status": "waiting",
            "notes": "",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    # The newest joiner sits at the back of the L queue.
    queue = staff.get("/api/waitlist?size_class=L&status=waiting").json()
    assert queue[-1]["id"] == body["id"]
    assert queue[-1]["position"] == len(queue)

    assert staff.delete(f"/api/waitlist/{body['id']}").status_code == 204
    assert body["id"] not in {row["id"] for row in staff.get("/api/waitlist").json()}


def test_waitlist_validation_reports_the_offending_field(staff):
    blank_owner = staff.post(
        "/api/waitlist",
        json={
            "owner_name": " ",
            "boat_name": "Petrel",
            "boat_length_m": 8.0,
            "size_class": "S",
            "joined_on": date.today().isoformat(),
            "status": "waiting",
        },
    )
    assert blank_owner.status_code == 422
    assert "owner_name" in blank_owner.json()["errors"]

    future = staff.post(
        "/api/waitlist",
        json={
            "owner_name": "Ada Bell",
            "boat_name": "Petrel",
            "boat_length_m": 8.0,
            "size_class": "S",
            "joined_on": (date.today() + timedelta(days=10)).isoformat(),
            "status": "waiting",
        },
    )
    assert future.status_code == 422
    assert "joined_on" in future.json()["errors"]


def test_placing_an_entry_takes_it_out_of_the_queue_and_restores_it(staff):
    waiting_before = staff.get("/api/waitlist?size_class=S&status=waiting").json()
    assert waiting_before
    target = waiting_before[0]

    placed = staff.patch(f"/api/waitlist/{target['id']}", json={"status": "placed"})
    assert placed.status_code == 200
    assert placed.json()["position"] is None

    still_waiting = staff.get("/api/waitlist?size_class=S&status=waiting").json()
    assert target["id"] not in {row["id"] for row in still_waiting}

    restored = staff.patch(f"/api/waitlist/{target['id']}", json={"status": "waiting"})
    assert restored.status_code == 200
    assert restored.json()["position"] == 1  # oldest joiner regains its place


def test_waitlist_search_matches_owner_or_boat(staff):
    rows = staff.get("/api/waitlist?q=Zephyr").json()
    assert rows
    assert all("Zephyr" in row["boat_name"] or "Zephyr" in row["owner_name"] for row in rows)


# --------------------------------------------------------------------------- #
# Inspections
# --------------------------------------------------------------------------- #
def test_inspections_filter_by_year_and_buoy(staff):
    all_rows = staff.get("/api/inspections").json()
    year = all_rows[0]["inspected_on"][:4]
    filtered = staff.get(f"/api/inspections?year={year}").json()
    assert filtered
    assert all(row["inspected_on"].startswith(year) for row in filtered)

    buoy_id = all_rows[0]["buoy_id"]
    by_buoy = staff.get(f"/api/inspections?buoy_id={buoy_id}").json()
    assert by_buoy
    assert all(row["buoy_id"] == buoy_id for row in by_buoy)
    assert all(row["buoy_code"] and row["bay_name"] for row in by_buoy)


def test_annual_guard_refuses_a_second_inspection_in_the_same_year(staff):
    rows = staff.get("/api/inspections").json()
    target = rows[0]
    response = staff.post(
        "/api/inspections",
        json={
            "buoy_id": target["buoy_id"],
            "inspected_on": date.today().isoformat(),
            "inspector_name": "M. Kavanagh",
            "chain_wear_percent": 30,
            "notes": "Second survey of the year.",
        },
    )
    assert response.status_code == 409
    assert str(date.today().year) in response.json()["message"]
    assert "inspected_on" in response.json()["errors"]


def test_chain_wear_is_bounded(staff):
    rows = staff.get("/api/inspections").json()
    buoy_id = rows[0]["buoy_id"]
    for bad in (-1, 120):
        response = staff.post(
            "/api/inspections",
            json={
                "buoy_id": buoy_id,
                "inspected_on": "2001-01-01",
                "inspector_name": "M. Kavanagh",
                "chain_wear_percent": bad,
                "notes": "",
            },
        )
        assert response.status_code == 422
        assert "chain_wear_percent" in response.json()["errors"]


def test_inspection_is_flagged_as_attention_at_fifty_percent(staff, bay_id):
    buoy = staff.post(
        "/api/buoys",
        json={
            "bay_id": bay_id,
            "code": "ZZ-21",
            "size_class": "S",
            "depth_m": 2.0,
            "swing_radius_m": 4.0,
            "status": "available",
            "notes": "",
        },
    ).json()

    created = staff.post(
        "/api/inspections",
        json={
            "buoy_id": buoy["id"],
            "inspected_on": date.today().isoformat(),
            "inspector_name": "M. Kavanagh",
            "chain_wear_percent": 62,
            "notes": "Lower chain heavily worn.",
        },
    )
    assert created.status_code == 201
    assert created.json()["attention"] is True

    updated = staff.patch(f"/api/inspections/{created.json()['id']}", json={"chain_wear_percent": 20})
    assert updated.status_code == 200
    assert updated.json()["attention"] is False

    assert staff.delete(f"/api/inspections/{created.json()['id']}").status_code == 204
    staff.delete(f"/api/buoys/{buoy['id']}")


# --------------------------------------------------------------------------- #
# Overview
# --------------------------------------------------------------------------- #
def test_overview_aggregates_match_the_registers(staff):
    overview = staff.get("/api/overview").json()
    buoys = staff.get("/api/buoys").json()
    waiting = staff.get("/api/waitlist?status=waiting").json()

    assert overview["bay_count"] == len(staff.get("/api/bays").json())
    assert overview["buoy_count"] == len(buoys)
    assert (
        overview["buoys_available"] + overview["buoys_occupied"] + overview["buoys_maintenance"]
        == len(buoys)
    )
    assert overview["owners_waiting"] == len(waiting)
    assert set(overview["waiting_by_size"]) == {"S", "M", "L"}
    assert {row["size_class"] for row in overview["longest_waiting"]} <= {"S", "M", "L"}
    assert overview["overdue_inspections"], "the seed leaves buoys overdue so the dashboard has content"


def test_recording_an_inspection_clears_the_overdue_item(staff, bay_id):
    overview = staff.get("/api/overview").json()
    overdue = {row["code"] for row in overview["overdue_inspections"]}
    assert overdue

    target_code = sorted(overdue)[0]
    buoy = next(b for b in staff.get("/api/buoys").json() if b["code"] == target_code)
    created = staff.post(
        "/api/inspections",
        json={
            "buoy_id": buoy["id"],
            "inspected_on": date.today().isoformat(),
            "inspector_name": "D. Rowntree",
            "chain_wear_percent": 15,
            "notes": "Brought back into the annual cycle.",
        },
    )
    assert created.status_code == 201, created.text

    after = {row["code"] for row in staff.get("/api/overview").json()["overdue_inspections"]}
    assert target_code not in after

    staff.delete(f"/api/inspections/{created.json()['id']}")


def test_unknown_api_route_returns_json_not_html(staff):
    response = staff.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_security_headers_are_present(client):
    response = client.get("/api/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "default-src 'self'" in response.headers["content-security-policy"]
