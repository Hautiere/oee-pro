import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.events import EventType, MaintType


# ═══════════════════════════════════════════════════════
# MACHINE EVENTS
# ═══════════════════════════════════════════════════════

class MachineEventCreate(BaseModel):
    event_type: EventType
    started_at: datetime
    ended_at: Optional[datetime] = None
    quality_pct: int = 100
    note: Optional[str] = None

    @field_validator("quality_pct")
    @classmethod
    def clamp_quality(cls, v: int) -> int:
        return max(0, min(100, v))


class MachineEventUpdate(BaseModel):
    ended_at: Optional[datetime] = None
    quality_pct: Optional[int] = None
    note: Optional[str] = None


class InterventionOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    event_id: uuid.UUID
    machine_id: uuid.UUID
    cause: Optional[str]
    action: Optional[str]
    technician: Optional[str]
    duration_min: Optional[int]
    created_at: datetime


class MachineEventOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    machine_id: uuid.UUID
    event_type: EventType
    started_at: datetime
    ended_at: Optional[datetime]
    quality_pct: int
    note: Optional[str]
    created_at: datetime
    duration_min: Optional[int] = None
    interventions: list[InterventionOut] = []

    @classmethod
    def model_validate(cls, obj, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        # Calculer duration_min depuis le modèle
        if hasattr(obj, 'duration_min'):
            instance.duration_min = obj.duration_min
        return instance


# ═══════════════════════════════════════════════════════
# INTERVENTIONS
# ═══════════════════════════════════════════════════════

class InterventionCreate(BaseModel):
    cause: Optional[str] = None
    action: Optional[str] = None
    technician: Optional[str] = None
    duration_min: Optional[int] = None


# ═══════════════════════════════════════════════════════
# PLANNED MAINTENANCE
# ═══════════════════════════════════════════════════════

class PlannedMaintenanceCreate(BaseModel):
    planned_date: datetime
    duration_min: int
    maint_type: MaintType = MaintType.maint
    reason: Optional[str] = None


class PlannedMaintenanceUpdate(BaseModel):
    planned_date: Optional[datetime] = None
    duration_min: Optional[int] = None
    maint_type: Optional[MaintType] = None
    reason: Optional[str] = None
    is_done: Optional[bool] = None


class PlannedMaintenanceOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    machine_id: uuid.UUID
    planned_date: datetime
    duration_min: int
    maint_type: MaintType
    reason: Optional[str]
    is_done: bool
    created_at: datetime


# ═══════════════════════════════════════════════════════
# TIMELINE — réponse agrégée frontend
# ═══════════════════════════════════════════════════════

class TimelineResponse(BaseModel):
    machine_id: uuid.UUID
    events: list[MachineEventOut]
    planned: list[PlannedMaintenanceOut]
