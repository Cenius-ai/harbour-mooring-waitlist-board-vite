"""Harbour overview: the aggregate that answers 'what needs attention today'."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import Bay, Buoy, BuoyStatus, Inspection, SizeClass, User, WaitlistEntry, WaitlistStatus
from ..schemas import OverviewOut
from ..serializers import longest_waiting, overdue_buoys

router = APIRouter(prefix="/api/overview", tags=["overview"])


@router.get("", response_model=OverviewOut)
def overview(db: Session = Depends(get_db), _user: User = Depends(current_user)) -> OverviewOut:
    status_counts = dict(db.query(Buoy.status, func.count(Buoy.id)).group_by(Buoy.status).all())

    waiting_by_size = {size.value: 0 for size in (SizeClass.S, SizeClass.M, SizeClass.L)}
    for size, count in (
        db.query(WaitlistEntry.size_class, func.count(WaitlistEntry.id))
        .filter(WaitlistEntry.status == WaitlistStatus.WAITING)
        .group_by(WaitlistEntry.size_class)
        .all()
    ):
        waiting_by_size[size.value] = int(count)

    year = date.today().year
    inspections_this_year = int(
        db.query(func.count(Inspection.id))
        .filter(
            Inspection.inspected_on >= f"{year}-01-01",
            Inspection.inspected_on <= f"{year}-12-31",
        )
        .scalar()
        or 0
    )

    return OverviewOut(
        bay_count=int(db.query(func.count(Bay.id)).scalar() or 0),
        buoy_count=int(db.query(func.count(Buoy.id)).scalar() or 0),
        buoys_available=int(status_counts.get(BuoyStatus.AVAILABLE, 0)),
        buoys_occupied=int(status_counts.get(BuoyStatus.OCCUPIED, 0)),
        buoys_maintenance=int(status_counts.get(BuoyStatus.MAINTENANCE, 0)),
        owners_waiting=sum(waiting_by_size.values()),
        waiting_by_size=waiting_by_size,
        overdue_inspections=overdue_buoys(db),
        longest_waiting=longest_waiting(db),
        inspections_this_year=inspections_this_year,
    )
