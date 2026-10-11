"""Owner waitlist: date-ordered queues per mooring size class."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import ApiError, current_user, no_content
from ..models import SizeClass, User, WaitlistEntry, WaitlistStatus
from ..schemas import WaitlistCreate, WaitlistOut, WaitlistUpdate
from ..serializers import queue_positions, to_waitlist_out

router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])

SIZE_ORDER = {SizeClass.S: 0, SizeClass.M: 1, SizeClass.L: 2}


def _load_entry(db: Session, entry_id: int) -> WaitlistEntry:
    entry = db.get(WaitlistEntry, entry_id)
    if entry is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Waitlist entry not found")
    return entry


def _serialise(db: Session, entries: list[WaitlistEntry]) -> list[WaitlistOut]:
    positions = queue_positions(db)
    ordered = sorted(entries, key=lambda entry: (SIZE_ORDER[entry.size_class], entry.joined_on, entry.id))
    return [to_waitlist_out(entry, positions.get(entry.id)) for entry in ordered]


@router.get("", response_model=list[WaitlistOut])
def list_waitlist(
    size_class: SizeClass | None = Query(default=None),
    status_filter: WaitlistStatus | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=60),
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> list[WaitlistOut]:
    query = db.query(WaitlistEntry)
    if size_class is not None:
        query = query.filter(WaitlistEntry.size_class == size_class)
    if status_filter is not None:
        query = query.filter(WaitlistEntry.status == status_filter)
    if q and q.strip():
        needle = f"%{q.strip()}%"
        query = query.filter(
            or_(WaitlistEntry.owner_name.ilike(needle), WaitlistEntry.boat_name.ilike(needle))
        )
    return _serialise(db, query.all())


@router.get("/{entry_id}", response_model=WaitlistOut)
def get_waitlist_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> WaitlistOut:
    return _serialise(db, [_load_entry(db, entry_id)])[0]


@router.post("", response_model=WaitlistOut, status_code=status.HTTP_201_CREATED)
def create_waitlist_entry(
    payload: WaitlistCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> WaitlistOut:
    entry = WaitlistEntry(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _serialise(db, [entry])[0]


@router.patch("/{entry_id}", response_model=WaitlistOut)
def update_waitlist_entry(
    entry_id: int,
    payload: WaitlistUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> WaitlistOut:
    entry = _load_entry(db, entry_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    # Re-serialising after the write recomputes queue positions, so an entry whose
    # status changed back to waiting regains its date-ordered place immediately.
    return _serialise(db, [entry])[0]


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_waitlist_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> Response:
    entry = _load_entry(db, entry_id)
    db.delete(entry)
    db.commit()
    return no_content()
