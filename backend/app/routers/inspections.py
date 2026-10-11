"""Annual mooring inspections with chain wear and the duplicate-year guard."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..deps import ApiError, current_user, no_content
from ..models import Buoy, Inspection, User
from ..schemas import InspectionCreate, InspectionOut, InspectionUpdate
from ..serializers import to_inspection_out

router = APIRouter(prefix="/api/inspections", tags=["inspections"])


def _load_inspection(db: Session, inspection_id: int) -> Inspection:
    inspection = (
        db.query(Inspection)
        .options(joinedload(Inspection.buoy).joinedload(Buoy.bay))
        .filter(Inspection.id == inspection_id)
        .one_or_none()
    )
    if inspection is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Inspection not found")
    return inspection


def _load_buoy(db: Session, buoy_id: int) -> Buoy:
    buoy = db.query(Buoy).options(joinedload(Buoy.bay)).filter(Buoy.id == buoy_id).one_or_none()
    if buoy is None:
        message = "Choose an existing buoy"
        raise ApiError(status.HTTP_422_UNPROCESSABLE_ENTITY, message, {"buoy_id": message})
    return buoy


def _guard_annual(db: Session, buoy: Buoy, inspected_on, exclude_id: int | None = None) -> None:
    """Refuse a second inspection for the same buoy in the same calendar year."""
    year = inspected_on.year
    query = (
        db.query(Inspection)
        .filter(Inspection.buoy_id == buoy.id)
        .filter(Inspection.inspected_on >= f"{year}-01-01")
        .filter(Inspection.inspected_on <= f"{year}-12-31")
    )
    if exclude_id is not None:
        query = query.filter(Inspection.id != exclude_id)
    if query.first() is not None:
        message = f"This buoy already has an inspection recorded for {year}"
        raise ApiError(status.HTTP_409_CONFLICT, message, {"inspected_on": message})


def _guard_unique_date(db: Session, buoy_id: int, inspected_on, exclude_id: int | None = None) -> None:
    query = db.query(Inspection).filter(
        Inspection.buoy_id == buoy_id, Inspection.inspected_on == inspected_on
    )
    if exclude_id is not None:
        query = query.filter(Inspection.id != exclude_id)
    if query.first() is not None:
        message = "This buoy already has an inspection recorded on that date"
        raise ApiError(status.HTTP_409_CONFLICT, message, {"inspected_on": message})


@router.get("", response_model=list[InspectionOut])
def list_inspections(
    year: int | None = Query(default=None, ge=1990, le=2100),
    buoy_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> list[InspectionOut]:
    query = db.query(Inspection).options(joinedload(Inspection.buoy).joinedload(Buoy.bay))
    if year is not None:
        query = query.filter(
            Inspection.inspected_on >= f"{year}-01-01",
            Inspection.inspected_on <= f"{year}-12-31",
        )
    if buoy_id is not None:
        query = query.filter(Inspection.buoy_id == buoy_id)
    inspections = query.order_by(Inspection.inspected_on.desc(), Inspection.id.desc()).all()
    return [to_inspection_out(inspection) for inspection in inspections]


@router.post("", response_model=InspectionOut, status_code=status.HTTP_201_CREATED)
def create_inspection(
    payload: InspectionCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> InspectionOut:
    buoy = _load_buoy(db, payload.buoy_id)
    _guard_annual(db, buoy, payload.inspected_on)
    _guard_unique_date(db, buoy.id, payload.inspected_on)

    inspection = Inspection(**payload.model_dump())
    db.add(inspection)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        message = "This buoy already has an inspection recorded on that date"
        raise ApiError(status.HTTP_409_CONFLICT, message, {"inspected_on": message}) from exc
    db.refresh(inspection)
    return to_inspection_out(_load_inspection(db, inspection.id))


@router.patch("/{inspection_id}", response_model=InspectionOut)
def update_inspection(
    inspection_id: int,
    payload: InspectionUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> InspectionOut:
    inspection = _load_inspection(db, inspection_id)
    changes = payload.model_dump(exclude_unset=True)

    target_buoy_id = changes.get("buoy_id") or inspection.buoy_id
    target_date = changes.get("inspected_on") or inspection.inspected_on
    buoy = _load_buoy(db, target_buoy_id)
    _guard_annual(db, buoy, target_date, exclude_id=inspection.id)
    _guard_unique_date(db, target_buoy_id, target_date, exclude_id=inspection.id)

    for field, value in changes.items():
        if value is not None:
            setattr(inspection, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        message = "This buoy already has an inspection recorded on that date"
        raise ApiError(status.HTTP_409_CONFLICT, message, {"inspected_on": message}) from exc
    db.refresh(inspection)
    return to_inspection_out(_load_inspection(db, inspection.id))


@router.delete("/{inspection_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_inspection(
    inspection_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(current_user),
) -> Response:
    inspection = _load_inspection(db, inspection_id)
    db.delete(inspection)
    db.commit()
    return no_content()
