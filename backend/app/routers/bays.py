"""Bay reference data (seeded harbour geography, read-only in the UI)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import Bay, Buoy, BuoyStatus, User, WaitlistEntry, WaitlistStatus
from ..schemas import BayOut

router = APIRouter(prefix="/api/bays", tags=["bays"])


@router.get("", response_model=list[BayOut])
def list_bays(db: Session = Depends(get_db), _user: User = Depends(current_user)) -> list[BayOut]:
    """Every bay with its buoy count and how many owners are queued for a mooring
    size that this bay currently has free - the number that is actually actionable."""
    buoy_counts = dict(db.query(Buoy.bay_id, func.count(Buoy.id)).group_by(Buoy.bay_id).all())

    free_sizes: dict[int, set] = {}
    for bay_id, size_class in (
        db.query(Buoy.bay_id, Buoy.size_class)
        .filter(Buoy.status == BuoyStatus.AVAILABLE)
        .distinct()
        .all()
    ):
        free_sizes.setdefault(bay_id, set()).add(size_class)

    waiting_counts: dict[object, int] = dict(
        db.query(WaitlistEntry.size_class, func.count(WaitlistEntry.id))
        .filter(WaitlistEntry.status == WaitlistStatus.WAITING)
        .group_by(WaitlistEntry.size_class)
        .all()
    )

    bays = db.query(Bay).order_by(Bay.name.asc()).all()
    return [
        BayOut(
            id=bay.id,
            name=bay.name,
            description=bay.description,
            buoy_count=int(buoy_counts.get(bay.id, 0)),
            waiting_count=sum(
                int(waiting_counts.get(size, 0)) for size in free_sizes.get(bay.id, set())
            ),
        )
        for bay in bays
    ]
