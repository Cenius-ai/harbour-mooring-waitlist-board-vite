"""Pydantic v2 request/response schemas.

Request schemas double as the boundary validation layer: unknown fields are
rejected and every rule the UI mirrors is enforced again here.
"""

from __future__ import annotations

import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import BuoyStatus, SizeClass, WaitlistStatus

CODE_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9-]{1,11}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
class LoginRequest(ApiModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserOut(ApiModel):
    id: int
    email: str
    username: str
    full_name: str
    role: str


# --------------------------------------------------------------------------- #
# Bays
# --------------------------------------------------------------------------- #
class BayOut(ApiModel):
    id: int
    name: str
    description: str
    buoy_count: int = 0
    waiting_count: int = 0


# --------------------------------------------------------------------------- #
# Buoys
# --------------------------------------------------------------------------- #
class BuoyBase(ApiModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    code: str = Field(min_length=2, max_length=12)
    size_class: SizeClass
    depth_m: float = Field(gt=0, le=99.9)
    swing_radius_m: float = Field(gt=0, le=99.9)
    status: BuoyStatus = BuoyStatus.AVAILABLE
    notes: str = Field(default="", max_length=2000)

    @field_validator("code")
    @classmethod
    def _normalise_code(cls, value: str) -> str:
        code = value.strip().upper()
        if not code:
            raise ValueError("Buoy code is required")
        if not CODE_PATTERN.match(code):
            raise ValueError("Use 2-12 characters: letters, digits and dashes")
        return code

    @field_validator("notes")
    @classmethod
    def _trim_notes(cls, value: str) -> str:
        return value.strip()


class BuoyCreate(BuoyBase):
    bay_id: int = Field(gt=0)


class BuoyUpdate(ApiModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    bay_id: int | None = Field(default=None, gt=0)
    code: str | None = Field(default=None, min_length=2, max_length=12)
    size_class: SizeClass | None = None
    depth_m: float | None = Field(default=None, gt=0, le=99.9)
    swing_radius_m: float | None = Field(default=None, gt=0, le=99.9)
    status: BuoyStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("code")
    @classmethod
    def _normalise_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        code = value.strip().upper()
        if not CODE_PATTERN.match(code):
            raise ValueError("Use 2-12 characters: letters, digits and dashes")
        return code

    @field_validator("notes")
    @classmethod
    def _trim_notes(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class BuoyOut(ApiModel):
    id: int
    bay_id: int
    bay_name: str
    code: str
    size_class: SizeClass
    depth_m: float
    swing_radius_m: float
    status: BuoyStatus
    notes: str
    last_inspected_on: date | None = None
    next_inspection_due: date | None = None
    inspection_count: int = 0
    chain_wear_percent: int | None = None
    updated_at: datetime


# --------------------------------------------------------------------------- #
# Waitlist
# --------------------------------------------------------------------------- #
class WaitlistBase(ApiModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    owner_name: str = Field(min_length=2, max_length=120)
    owner_email: str = Field(default="", max_length=254)
    owner_phone: str = Field(default="", max_length=40)
    boat_name: str = Field(min_length=1, max_length=120)
    boat_length_m: float = Field(gt=0, le=99.9)
    size_class: SizeClass
    joined_on: date
    status: WaitlistStatus = WaitlistStatus.WAITING
    notes: str = Field(default="", max_length=2000)

    @field_validator("owner_name", "boat_name")
    @classmethod
    def _require_text(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("This field is required")
        return text

    @field_validator("owner_email")
    @classmethod
    def _optional_email(cls, value: str) -> str:
        email = value.strip()
        if email and not EMAIL_PATTERN.match(email):
            raise ValueError("Enter a valid email address")
        return email

    @field_validator("joined_on")
    @classmethod
    def _not_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Joining date cannot be in the future")
        return value

    @field_validator("notes")
    @classmethod
    def _trim(cls, value: str) -> str:
        return value.strip()


class WaitlistCreate(WaitlistBase):
    pass


class WaitlistUpdate(ApiModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    owner_name: str | None = Field(default=None, min_length=2, max_length=120)
    owner_email: str | None = Field(default=None, max_length=254)
    owner_phone: str | None = Field(default=None, max_length=40)
    boat_name: str | None = Field(default=None, min_length=1, max_length=120)
    boat_length_m: float | None = Field(default=None, gt=0, le=99.9)
    size_class: SizeClass | None = None
    joined_on: date | None = None
    status: WaitlistStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("owner_name", "boat_name")
    @classmethod
    def _require_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        if not text:
            raise ValueError("This field is required")
        return text

    @field_validator("owner_email")
    @classmethod
    def _optional_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        email = value.strip()
        if email and not EMAIL_PATTERN.match(email):
            raise ValueError("Enter a valid email address")
        return email

    @field_validator("joined_on")
    @classmethod
    def _not_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Joining date cannot be in the future")
        return value


class WaitlistOut(ApiModel):
    id: int
    owner_name: str
    owner_email: str
    owner_phone: str
    boat_name: str
    boat_length_m: float
    size_class: SizeClass
    joined_on: date
    status: WaitlistStatus
    notes: str
    position: int | None = None
    days_waiting: int = 0
    updated_at: datetime


# --------------------------------------------------------------------------- #
# Inspections
# --------------------------------------------------------------------------- #
class InspectionBase(ApiModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    inspected_on: date
    inspector_name: str = Field(min_length=2, max_length=120)
    chain_wear_percent: int = Field(ge=0, le=100)
    notes: str = Field(default="", max_length=2000)

    @field_validator("inspector_name")
    @classmethod
    def _require_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Inspector name is required")
        return name

    @field_validator("inspected_on")
    @classmethod
    def _not_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Inspection date cannot be in the future")
        return value

    @field_validator("notes")
    @classmethod
    def _trim(cls, value: str) -> str:
        return value.strip()


class InspectionCreate(InspectionBase):
    buoy_id: int = Field(gt=0)


class InspectionUpdate(ApiModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    buoy_id: int | None = Field(default=None, gt=0)
    inspected_on: date | None = None
    inspector_name: str | None = Field(default=None, min_length=2, max_length=120)
    chain_wear_percent: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("inspector_name")
    @classmethod
    def _require_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = value.strip()
        if not name:
            raise ValueError("Inspector name is required")
        return name

    @field_validator("inspected_on")
    @classmethod
    def _not_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Inspection date cannot be in the future")
        return value


class InspectionOut(ApiModel):
    id: int
    buoy_id: int
    buoy_code: str
    bay_name: str
    inspected_on: date
    inspector_name: str
    chain_wear_percent: int
    attention: bool
    notes: str
    updated_at: datetime


# --------------------------------------------------------------------------- #
# Overview
# --------------------------------------------------------------------------- #
class OverdueBuoyOut(ApiModel):
    id: int
    code: str
    bay_name: str
    size_class: SizeClass
    last_inspected_on: date | None = None
    days_overdue: int | None = None


class LongestWaitingOut(ApiModel):
    id: int
    owner_name: str
    boat_name: str
    size_class: SizeClass
    joined_on: date
    days_waiting: int


class OverviewOut(ApiModel):
    bay_count: int
    buoy_count: int
    buoys_available: int
    buoys_occupied: int
    buoys_maintenance: int
    owners_waiting: int
    waiting_by_size: dict[str, int]
    overdue_inspections: list[OverdueBuoyOut]
    longest_waiting: list[LongestWaitingOut]
    inspections_this_year: int
