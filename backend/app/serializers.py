"""Shared read helpers that turn ORM rows into API payloads."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import Buoy, Inspection, SizeClass, WaitlistEntry, WaitlistStatus
from .schemas import BuoyOut, InspectionOut, LongestWaitingOut, OverdueBuoyOut, WaitlistOut

ANNUAL_INTERVAL_DAYS = 365
ATTENTION_THRESHOLD = 50


def add_year(day: date) -> date:
    """One calendar year later, clamped for 29 February."""
    try:
        return day.replace(year=day.year + 1)
    except ValueError:
        return day.replace(year=day.year + 1, day=28)


def inspection_summary(db: Session, buoy_ids: list[int]) -> dict[int, dict[str, object]]:
    """Last inspection date, record count and newest chain-wear reading."""
    if not buoy_ids:
        return {}
    summary: dict[int, dict[str, object]] = {}

    for buoy_id, count, last in (
        db.query(Inspection.buoy_id, func.count(Inspection.id), func.max(Inspection.inspected_on))
        .filter(Inspection.buoy_id.in_(buoy_ids))
        .group_by(Inspection.buoy_id)
        .all()
    ):
        summary[buoy_id] = {"count": int(count), "last": last}

    # The most recent reading drives the attention flag, so take the newest row
    # per buoy rather than whichever row the database happens to return last.
    for buoy_id, wear in (
        db.query(Inspection.buoy_id, Inspection.chain_wear_percent)
        .filter(Inspection.buoy_id.in_(buoy_ids))
        .order_by(Inspection.buoy_id.asc(), Inspection.inspected_on.asc(), Inspection.id.asc())
        .all()
    ):
        summary.setdefault(buoy_id, {"count": 0, "last": None})["wear"] = wear

    return summary


def to_buoy_out(buoy: Buoy, summary: dict[int, dict[str, object]]) -> BuoyOut:
    stats = summary.get(buoy.id, {})
    last = stats.get("last")
    return BuoyOut(
        id=buoy.id,
        bay_id=buoy.bay_id,
        bay_name=buoy.bay.name,
        code=buoy.code,
        size_class=buoy.size_class,
        depth_m=float(buoy.depth_m),
        swing_radius_m=float(buoy.swing_radius_m),
        status=buoy.status,
        notes=buoy.notes,
        last_inspected_on=last,
        next_inspection_due=add_year(last) if last else None,
        inspection_count=int(stats.get("count") or 0),
        chain_wear_percent=stats.get("wear"),
        updated_at=buoy.updated_at,
    )


def to_inspection_out(inspection: Inspection) -> InspectionOut:
    return InspectionOut(
        id=inspection.id,
        buoy_id=inspection.buoy_id,
        buoy_code=inspection.buoy.code,
        bay_name=inspection.buoy.bay.name,
        inspected_on=inspection.inspected_on,
        inspector_name=inspection.inspector_name,
        chain_wear_percent=inspection.chain_wear_percent,
        attention=inspection.chain_wear_percent >= ATTENTION_THRESHOLD,
        notes=inspection.notes,
        updated_at=inspection.updated_at,
    )


def queue_positions(db: Session) -> dict[int, int]:
    """1-based position of every waiting entry within its size class.

    Positions are always computed over the full waiting queue, so a filtered
    view still reports the owner's true place in line.
    """
    positions: dict[int, int] = {}
    counters: dict[SizeClass, int] = {size: 0 for size in SizeClass}
    waiting = (
        db.query(WaitlistEntry)
        .filter(WaitlistEntry.status == WaitlistStatus.WAITING)
        .order_by(WaitlistEntry.joined_on.asc(), WaitlistEntry.id.asc())
        .all()
    )
    for entry in waiting:
        counters[entry.size_class] += 1
        positions[entry.id] = counters[entry.size_class]
    return positions


def to_waitlist_out(entry: WaitlistEntry, position: int | None, today: date | None = None) -> WaitlistOut:
    reference = today or date.today()
    return WaitlistOut(
        id=entry.id,
        owner_name=entry.owner_name,
        owner_email=entry.owner_email,
        owner_phone=entry.owner_phone,
        boat_name=entry.boat_name,
        boat_length_m=float(entry.boat_length_m),
        size_class=entry.size_class,
        joined_on=entry.joined_on,
        status=entry.status,
        notes=entry.notes,
        position=position,
        days_waiting=max((reference - entry.joined_on).days, 0),
        updated_at=entry.updated_at,
    )


def overdue_buoys(db: Session, reference: date | None = None) -> list[OverdueBuoyOut]:
    """Buoys never inspected, or last inspected more than twelve months ago."""
    today = reference or date.today()
    cutoff = today - timedelta(days=ANNUAL_INTERVAL_DAYS)
    buoys = db.query(Buoy).order_by(Buoy.code.asc()).all()
    summary = inspection_summary(db, [buoy.id for buoy in buoys])

    overdue: list[OverdueBuoyOut] = []
    for buoy in buoys:
        last = summary.get(buoy.id, {}).get("last")
        if last is None:
            overdue.append(
                OverdueBuoyOut(
                    id=buoy.id,
                    code=buoy.code,
                    bay_name=buoy.bay.name,
                    size_class=buoy.size_class,
                    last_inspected_on=None,
                    days_overdue=None,
                )
            )
        elif last < cutoff:
            overdue.append(
                OverdueBuoyOut(
                    id=buoy.id,
                    code=buoy.code,
                    bay_name=buoy.bay.name,
                    size_class=buoy.size_class,
                    last_inspected_on=last,
                    days_overdue=(today - add_year(last)).days,
                )
            )
    # Never inspected first (longest neglect), then the oldest last inspection.
    overdue.sort(key=lambda item: (item.last_inspected_on is not None, item.last_inspected_on or date.min))
    return overdue


def longest_waiting(db: Session) -> list[LongestWaitingOut]:
    """The longest-waiting owner still in the queue, one per size class."""
    result: list[LongestWaitingOut] = []
    today = date.today()
    for size in (SizeClass.S, SizeClass.M, SizeClass.L):
        entry = (
            db.query(WaitlistEntry)
            .filter(WaitlistEntry.size_class == size, WaitlistEntry.status == WaitlistStatus.WAITING)
            .order_by(WaitlistEntry.joined_on.asc(), WaitlistEntry.id.asc())
            .first()
        )
        if entry is not None:
            result.append(
                LongestWaitingOut(
                    id=entry.id,
                    owner_name=entry.owner_name,
                    boat_name=entry.boat_name,
                    size_class=entry.size_class,
                    joined_on=entry.joined_on,
                    days_waiting=max((today - entry.joined_on).days, 0),
                )
            )
    return result
