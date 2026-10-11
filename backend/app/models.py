"""SQLAlchemy 2.0 domain models for the mooring board.

Relations: Bay -> Buoy -> Inspection. Waitlist entries stand alone: the queue is
derived by ordering on joining date within a mooring size class.
"""

from __future__ import annotations

import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SizeClass(str, enum.Enum):
    """Fixed mooring size class. Used as the queue key on both sides."""

    S = "S"
    M = "M"
    L = "L"


class BuoyStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"


class WaitlistStatus(str, enum.Enum):
    WAITING = "waiting"
    PLACED = "placed"
    WITHDRAWN = "withdrawn"


def _enum(enum_cls, name: str) -> SAEnum:
    """A portable VARCHAR + CHECK constraint enum (never a bare string)."""
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        validate_strings=True,
        length=20,
        values_callable=lambda cls: [member.value for member in cls],
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="staff")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Bay(Base):
    __tablename__ = "bays"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    buoys: Mapped[list["Buoy"]] = relationship(
        back_populates="bay", cascade="all, delete-orphan", order_by="Buoy.code"
    )


class Buoy(Base):
    __tablename__ = "buoys"
    __table_args__ = (
        CheckConstraint("depth_m > 0", name="ck_buoys_depth_positive"),
        CheckConstraint("swing_radius_m > 0", name="ck_buoys_swing_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bay_id: Mapped[int] = mapped_column(
        ForeignKey("bays.id", ondelete="CASCADE"), index=True, nullable=False
    )
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    size_class: Mapped[SizeClass] = mapped_column(_enum(SizeClass, "size_class"), nullable=False)
    depth_m: Mapped[float] = mapped_column(Numeric(4, 1, asdecimal=False), nullable=False)
    swing_radius_m: Mapped[float] = mapped_column(Numeric(4, 1, asdecimal=False), nullable=False)
    status: Mapped[BuoyStatus] = mapped_column(
        _enum(BuoyStatus, "buoy_status"), nullable=False, default=BuoyStatus.AVAILABLE
    )
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    bay: Mapped[Bay] = relationship(back_populates="buoys")
    inspections: Mapped[list["Inspection"]] = relationship(
        back_populates="buoy",
        cascade="all, delete-orphan",
        order_by="Inspection.inspected_on.desc()",
    )


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"
    __table_args__ = (
        CheckConstraint("boat_length_m > 0", name="ck_waitlist_boat_length_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_name: Mapped[str] = mapped_column(String(120), nullable=False)
    owner_email: Mapped[str] = mapped_column(String(254), nullable=False, default="")
    owner_phone: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    boat_name: Mapped[str] = mapped_column(String(120), nullable=False)
    boat_length_m: Mapped[float] = mapped_column(Numeric(4, 1, asdecimal=False), nullable=False)
    size_class: Mapped[SizeClass] = mapped_column(_enum(SizeClass, "wl_size_class"), nullable=False)
    joined_on: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    status: Mapped[WaitlistStatus] = mapped_column(
        _enum(WaitlistStatus, "waitlist_status"), nullable=False, default=WaitlistStatus.WAITING
    )
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class Inspection(Base):
    __tablename__ = "inspections"
    __table_args__ = (
        CheckConstraint(
            "chain_wear_percent >= 0 AND chain_wear_percent <= 100",
            name="ck_inspections_chain_wear_range",
        ),
        # A buoy cannot carry two records for the same day; the wider "one per
        # calendar year" rule is enforced by the API so it can name the year.
        UniqueConstraint("buoy_id", "inspected_on", name="uq_inspections_buoy_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    buoy_id: Mapped[int] = mapped_column(
        ForeignKey("buoys.id", ondelete="CASCADE"), index=True, nullable=False
    )
    inspected_on: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    inspector_name: Mapped[str] = mapped_column(String(120), nullable=False)
    chain_wear_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    buoy: Mapped[Buoy] = relationship(back_populates="inspections")
