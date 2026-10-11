"""Mooring buoy register: read, create, edit and delete."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..deps import ApiError, current_user, field_error, no_content
from ..models import Bay, Buoy, BuoyStatus, SizeClass, User
from ..schemas import BuoyCreate, BuoyOut, BuoyUpdate
from ..serializers import inspection_summary, to_buoy_out

router = APIRouter(prefix="/api/buoys", tags=["buoys"])


def _load_buoy(db: Session, buoy_id: int) -> Buoy:
    buoy = db.query(Buoy).options(joinedload(Buoy.bay)).filter(Buoy.id == buoy_id).one_or_none()
    if buoy is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Buoy not found")
    return buoy


def _require_bay(db: Session, bay_id: int) -> Bay:
    bay = db.get(Bay, bay_id)
    if bay is None:
        raise field_error("bay_id", "Choose an existing bay")
    return bay


def _require_unique_code(db: Session, code: str, exclude_id: int | None = None) -> None:
    query = db.query(Buoy).filter(Buoy.code == code)
    if exclude_id is not None:
        query = query.filter(Buoy.id != exclude_id)
    if query.first() is not None:
        raise field_error("code", "Buoy code already exists", status.HTTP_409_CONFLICT)


@router.get("", response_model=list[BuoyOut])
def list_buoys(
    bay_id: int | None = Query(default=None),
    size_class: SizeClass | None = Query(default=None),
    status_filter: BuoyStatus | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=60),
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> list[BuoyOut]:
    query = db.query(Buoy).options(joinedload(Buoy.bay))
    if bay_id is not None:
        query = query.filter(Buoy.bay_id == bay_id)
    if size_class is not None:
        query = query.filter(Buoy.size_class == size_class)
    if status_filter is not None:
        query = query.filter(Buoy.status == status_filter)
    if q and q.strip():
        needle = q.strip()
        query = query.filter(
            or_(Buoy.code.like(f"%{needle.upper()}%"), Buoy.notes.like(f"%{needle}%"))
        )

    buoys = query.order_by(Buoy.bay_id.asc(), Buoy.code.asc()).all()
    summary = inspection_summary(db, [buoy.id for buoy in buoys])
    return [to_buoy_out(buoy, summary) for buoy in buoys]


@router.get("/{buoy_id}", response_model=BuoyOut)
def get_buoy(
    buoy_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> BuoyOut:
    buoy = _load_buoy(db, buoy_id)
    return to_buoy_out(buoy, inspection_summary(db, [buoy.id]))


@router.post("", response_model=BuoyOut, status_code=status.HTTP_201_CREATED)
def create_buoy(
    payload: BuoyCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> BuoyOut:
    _require_bay(db, payload.bay_id)
    _require_unique_code(db, payload.code)

    buoy = Buoy(
        bay_id=payload.bay_id,
        code=payload.code,
        size_class=payload.size_class,
        depth_m=payload.depth_m,
        swing_radius_m=payload.swing_radius_m,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(buoy)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise field_error("code", "Buoy code already exists", status.HTTP_409_CONFLICT) from exc
    db.refresh(buoy)
    return to_buoy_out(_load_buoy(db, buoy.id), inspection_summary(db, [buoy.id]))


@router.patch("/{buoy_id}", response_model=BuoyOut)
def update_buoy(
    buoy_id: int,
    payload: BuoyUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> BuoyOut:
    buoy = _load_buoy(db, buoy_id)
    changes = payload.model_dump(exclude_unset=True)

    if "bay_id" in changes and changes["bay_id"] is not None:
        _require_bay(db, changes["bay_id"])
        buoy.bay_id = changes["bay_id"]
    if "code" in changes and changes["code"] is not None and changes["code"] != buoy.code:
        _require_unique_code(db, changes["code"], exclude_id=buoy.id)
        buoy.code = changes["code"]
    for field in ("size_class", "depth_m", "swing_radius_m", "status", "notes"):
        if changes.get(field) is not None:
            setattr(buoy, field, changes[field])

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise field_error("code", "Buoy code already exists", status.HTTP_409_CONFLICT) from exc
    db.refresh(buoy)
    return to_buoy_out(_load_buoy(db, buoy.id), inspection_summary(db, [buoy.id]))


@router.delete("/{buoy_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_buoy(
    buoy_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> Response:
    """Delete a buoy together with its inspection records (ON DELETE CASCADE)."""
    buoy = _load_buoy(db, buoy_id)
    db.delete(buoy)
    db.commit()
    return no_content()
