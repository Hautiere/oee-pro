import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class EventType(str, enum.Enum):
    running = "running"
    idle    = "idle"
    down    = "down"
    maint   = "maint"


class MaintType(str, enum.Enum):
    maint = "maint"
    down  = "down"
    idle  = "idle"


class MachineEvent(Base):
    """
    Événement machine : période de fonctionnement/arrêt.
    Source de vérité pour le calcul OEE.
    """
    __tablename__ = "machine_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="event_type"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Qualité — uniquement pour les événements running
    quality_pct: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Qui a saisi
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    interventions: Mapped[list["Intervention"]] = relationship(
        "Intervention", back_populates="event", cascade="all, delete-orphan"
    )

    @property
    def duration_min(self) -> Optional[int]:
        if self.ended_at:
            return int((self.ended_at - self.started_at).total_seconds() / 60)
        return None


class Intervention(Base):
    """
    Intervention opérateur/maintenance sur un arrêt machine.
    """
    __tablename__ = "interventions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("machine_events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    machine_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Cause et action
    cause: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    action: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    technician: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    duration_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Qui a saisi
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    event: Mapped["MachineEvent"] = relationship("MachineEvent", back_populates="interventions")


class PlannedMaintenance(Base):
    """
    Maintenance planifiée — fenêtre d'arrêt prévu.
    Affichée sur la timeline et prise en compte dans le calcul OEE.
    """
    __tablename__ = "planned_maintenance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    planned_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    maint_type: Mapped[MaintType] = mapped_column(
        Enum(MaintType, name="maint_type"), default=MaintType.maint, nullable=False
    )
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
