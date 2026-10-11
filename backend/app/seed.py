"""Idempotent seed of the demo harbour.

The seed is safe to run on every boot: every row is looked up by its natural key
before insert, so restarts never duplicate records and a partially populated
database is completed rather than skipped.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session

from .auth import hash_password, normalise_email
from .db import Base, SessionLocal, engine
from .models import (
    Bay,
    Buoy,
    BuoyStatus,
    Inspection,
    SizeClass,
    User,
    WaitlistEntry,
    WaitlistStatus,
)

logger = logging.getLogger("harbour.seed")

# The documented demo staff accounts. The first entry is the platform's standard
# demo login and must always exist; both accounts have full staff access.
DEMO_STAFF = [
    {
        "email": "cenius@cenius.ai",
        "username": "cenius",
        "full_name": "Ines Marchetti, Harbour Master",
        "password": "cenius",
        "role": "staff",
    },
    {
        "email": "office@harbourpoint.example",
        "username": "office",
        "full_name": "Elspeth Nairn, Harbour Office",
        "password": "harbour-office",
        "role": "staff",
    },
]

BAYS = [
    ("North Bay", "Sheltered inner basin. The harbour's deepest swinging moorings."),
    ("East Bay", "Channel-side moorings off the eastern breakwater; exposed to the ebb."),
    ("South Bay", "Mud berths behind the quay wall; shallowest water in the harbour."),
    ("West Bay", "Small craft basin beside the sailing club pontoon."),
]

# (code, bay, size, depth_m, swing_radius_m, status, notes)
BUOYS = [
    ("NB-01", "North Bay", SizeClass.S, 2.4, 4.5, BuoyStatus.OCCUPIED, "Chain replaced at the last two annual inspections."),
    ("NB-02", "North Bay", SizeClass.M, 3.1, 6.0, BuoyStatus.OCCUPIED, "Swing clear of the north wall by 2 m at low water."),
    ("NB-03", "North Bay", SizeClass.S, 2.1, 4.0, BuoyStatus.MAINTENANCE, "Sinker under survey after the January groundswell."),
    ("NB-04", "North Bay", SizeClass.L, 4.6, 9.5, BuoyStatus.AVAILABLE, "Deepest berth in the basin; suits a long keel."),
    ("SB-01", "South Bay", SizeClass.M, 3.6, 6.5, BuoyStatus.OCCUPIED, "Dries to 0.4 m at springs."),
    ("SB-02", "South Bay", SizeClass.M, 3.2, 6.0, BuoyStatus.AVAILABLE, "Riser shackle replaced last season."),
    ("SB-03", "South Bay", SizeClass.L, 5.2, 10.5, BuoyStatus.OCCUPIED, "Wide swing area; keep clear of the dredged channel."),
    ("SB-04", "South Bay", SizeClass.S, 2.2, 4.2, BuoyStatus.AVAILABLE, "Accessible only either side of high water."),
    ("SB-05", "South Bay", SizeClass.L, 4.8, 9.0, BuoyStatus.MAINTENANCE, "Wear in the lower chain; swivel to be replaced."),
    ("EB-01", "East Bay", SizeClass.S, 1.9, 3.8, BuoyStatus.OCCUPIED, "Close to the slipway; short scope on the mooring."),
    ("EB-02", "East Bay", SizeClass.M, 2.9, 5.5, BuoyStatus.AVAILABLE, "Protected from the west by the breakwater."),
    ("EB-03", "East Bay", SizeClass.L, 4.4, 8.5, BuoyStatus.AVAILABLE, "Recently re-laid ground tackle."),
    ("WB-01", "West Bay", SizeClass.S, 2.0, 4.0, BuoyStatus.OCCUPIED, "Club pontoon is 12 m to starboard."),
    ("WB-02", "West Bay", SizeClass.M, 3.3, 6.2, BuoyStatus.AVAILABLE, "Popular berth; sheltered in all but easterlies."),
]

# (owner, email, phone, boat, length_m, size, days_since_joined, status, notes)
WAITLIST = [
    ("Marcus Deverell", "m.deverell@example.com", "07700 900118", "Halcyon", 9.8, SizeClass.M, 900, WaitlistStatus.WAITING, "Happy to take an East Bay berth."),
    ("Farid Haddad", "farid.haddad@example.com", "07700 900204", "Zephyr", 13.2, SizeClass.L, 820, WaitlistStatus.WAITING, "Long keel; needs at least 4.5 m."),
    ("Ruth Ainsworth", "r.ainsworth@example.com", "07700 900076", "Otter", 6.4, SizeClass.S, 790, WaitlistStatus.WAITING, "First on the small-craft list."),
    ("Tomasz Nowicki", "t.nowicki@example.com", "07700 900331", "Wanderer", 10.4, SizeClass.M, 700, WaitlistStatus.WAITING, ""),
    ("Priya Raghavan", "priya.raghavan@example.com", "07700 900447", "Tern", 7.2, SizeClass.S, 610, WaitlistStatus.WAITING, "Currently on a temporary trot."),
    ("Bridget Callaghan", "b.callaghan@example.com", "07700 900512", "Sea Harrier", 12.4, SizeClass.L, 560, WaitlistStatus.WAITING, ""),
    ("Gethin Lloyd", "gethin.lloyd@example.com", "07700 900158", "Bramble", 6.1, SizeClass.S, 520, WaitlistStatus.WITHDRAWN, "Sold the boat; asked to be taken off the list."),
    ("Colin Ferris", "colin.ferris@example.com", "07700 900263", "[redacted]", 6.9, SizeClass.S, 480, WaitlistStatus.WAITING, ""),
    ("Helen Braithwaite", "h.braithwaite@example.com", "07700 900689", "Curlew", 8.7, SizeClass.M, 380, WaitlistStatus.WAITING, "Prefers South Bay."),
    ("Alan Whitcombe", "a.whitcombe@example.com", "07700 900344", "Nimbus", 14.1, SizeClass.L, 300, WaitlistStatus.PLACED, "Took SB-03 when it came free."),
    ("Danny Okonkwo", "d.okonkwo@example.com", "07700 900722", "Kestrel", 9.5, SizeClass.M, 240, WaitlistStatus.PLACED, "Placed on NB-02."),
    ("Sister Aoife Brennan", "a.brennan@example.com", "07700 900901", "St Brendan", 9.2, SizeClass.M, 180, WaitlistStatus.WAITING, "Community sail-training boat."),
]

# (buoy code, days_ago, inspector, chain_wear_percent, notes)
# The recent readings sit inside the last twelve months; the older ones are over
# a year old, so the overview has a real overdue list to work with.
INSPECTIONS = [
    ("NB-01", 500, "D. Rowntree", 38, "Swivel free; upper shackle showing light wear."),
    ("NB-01", 30, "D. Rowntree", 22, "Chain gauged at three points; all within tolerance."),
    ("NB-02", 430, "M. Kavanagh", 55, "Noticeable link wear at the riser; flagged for the next lift-out."),
    ("SB-01", 400, "M. Kavanagh", 61, "Lower chain below accept limit; replacement quoted."),
    ("SB-02", 460, "D. Rowntree", 44, "Sinker sound; chain showing even wear."),
    ("EB-01", 490, "P. Lindqvist", 72, "Heavy wear plus a twisted link; urgent."),
    ("EB-01", 75, "P. Lindqvist", 46, "Twisted link cut out and re-spliced."),
    ("EB-02", 110, "P. Lindqvist", 18, "New ground tackle; no measurable wear."),
    ("WB-01", 45, "M. Kavanagh", 9, "Mooring in good order."),
]


def ensure_staff(db: Session) -> int:
    """Create the documented demo staff accounts. Idempotent by email."""
    created = 0
    for record in DEMO_STAFF:
        email = normalise_email(record["email"])
        if db.query(User).filter(User.email == email).one_or_none() is not None:
            continue
        db.add(
            User(
                email=email,
                username=record["username"],
                full_name=record["full_name"],
                password_hash=hash_password(record["password"]),
                role=record["role"],
            )
        )
        created += 1
    if created:
        db.commit()
    return created


def ensure_bays(db: Session) -> dict[str, Bay]:
    created = 0
    for name, description in BAYS:
        if db.query(Bay).filter(Bay.name == name).one_or_none() is None:
            db.add(Bay(name=name, description=description))
            created += 1
    if created:
        db.commit()
    return {bay.name: bay for bay in db.query(Bay).all()}


def ensure_buoys(db: Session, bays: dict[str, Bay]) -> dict[str, Buoy]:
    created = 0
    for code, bay_name, size, depth, swing, status, notes in BUOYS:
        if db.query(Buoy).filter(Buoy.code == code).one_or_none() is not None:
            continue
        bay = bays[bay_name]
        if bay.id is None:
            raise RuntimeError(f"bay {bay_name} has no id; seed bays before buoys")
        db.add(
            Buoy(
                bay_id=bay.id,
                code=code,
                size_class=size,
                depth_m=depth,
                swing_radius_m=swing,
                status=status,
                notes=notes,
            )
        )
        created += 1
    if created:
        db.commit()
    return {buoy.code: buoy for buoy in db.query(Buoy).all()}


def ensure_waitlist(db: Session, today: date) -> int:
    created = 0
    for owner, email, phone, boat, length, size, days_ago, status, notes in WAITLIST:
        exists = (
            db.query(WaitlistEntry)
            .filter(
                WaitlistEntry.owner_name == owner,
                WaitlistEntry.boat_name == boat,
                WaitlistEntry.size_class == size,
            )
            .first()
        )
        if exists is not None:
            continue
        db.add(
            WaitlistEntry(
                owner_name=owner,
                owner_email=email,
                owner_phone=phone,
                boat_name=boat,
                boat_length_m=length,
                size_class=size,
                joined_on=today - timedelta(days=days_ago),
                status=status,
                notes=notes,
            )
        )
        created += 1
    if created:
        db.commit()
    return created


def ensure_inspections(db: Session, buoys: dict[str, Buoy], today: date) -> int:
    created = 0
    for code, days_ago, inspector, wear, notes in INSPECTIONS:
        buoy = buoys[code]
        if buoy.id is None:
            raise RuntimeError(f"buoy {code} has no id; seed buoys before inspections")
        inspected_on = today - timedelta(days=days_ago)
        exists = (
            db.query(Inspection)
            .filter(Inspection.buoy_id == buoy.id, Inspection.inspected_on == inspected_on)
            .first()
        )
        if exists is not None:
            continue
        db.add(
            Inspection(
                buoy_id=buoy.id,
                inspected_on=inspected_on,
                inspector_name=inspector,
                chain_wear_percent=wear,
                notes=notes,
            )
        )
        created += 1
    if created:
        db.commit()
    return created


def seed_all(db: Session | None = None) -> dict[str, int]:
    """Create the schema (if missing) and seed the demo harbour idempotently.

    Returns the number of rows *created* by this call, so a re-run honestly
    reports zeroes rather than re-counting what was already there.
    """
    Base.metadata.create_all(engine)
    own_session = db is None
    session = db or SessionLocal()
    try:
        today = date.today()
        created = {
            "users": ensure_staff(session),
            "bays": 0,
            "buoys": 0,
            "waitlist_entries": 0,
            "inspections": 0,
        }
        before_bays = session.query(Bay).count()
        before_buoys = session.query(Buoy).count()

        bays = ensure_bays(session)
        buoys = ensure_buoys(session, bays)
        created["waitlist_entries"] = ensure_waitlist(session, today)
        created["inspections"] = ensure_inspections(session, buoys, today)
        created["bays"] = session.query(Bay).count() - before_bays
        created["buoys"] = session.query(Buoy).count() - before_buoys
        session.commit()
        logger.info("seed complete: %s row(s) created", created)
        return created
    finally:
        if own_session:
            session.close()


def main() -> None:
    """Entry point for `python3 -m seed` and the normal boot path."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    created = seed_all()
    print(
        "Harbour seed complete - "
        f"{created['users']} staff account(s), {created['bays']} bay(s), "
        f"{created['buoys']} buoy(s), {created['waitlist_entries']} waitlist entr(ies), "
        f"{created['inspections']} inspection record(s) inserted."
    )


if __name__ == "__main__":
    main()
