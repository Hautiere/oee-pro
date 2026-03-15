"""
Service événements — logique métier découplée de FastAPI.
Gère MachineEvent, Intervention, PlannedMaintenance.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.events import EventType, Intervention, MachineEvent, MaintType, PlannedMaintenance
from app.models.referentiel import Machine
from app.schemas.events import (
    InterventionCreate, MachineEventCreate, MachineEventUpdate,
    PlannedMaintenanceCreate, PlannedMaintenanceUpdate,
)


class NotFoundError(Exception):
    pass


# ═══════════════════════════════════════════════════════
# MACHINE EVENTS
# ═══════════════════════════════════════════════════════

async def list_events(
    db: AsyncSession,
    machine_id: uuid.UUID,
    days: int = 14,
) -> list[MachineEvent]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(MachineEvent)
        .where(
            and_(
                MachineEvent.machine_id == machine_id,
                MachineEvent.started_at >= since,
            )
        )
        .options(selectinload(MachineEvent.interventions))
        .order_by(MachineEvent.started_at)
    )
    return list(result.scalars().all())


async def get_event(db: AsyncSession, event_id: uuid.UUID) -> MachineEvent:
    result = await db.execute(
        select(MachineEvent)
        .where(MachineEvent.id == event_id)
        .options(selectinload(MachineEvent.interventions))
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise NotFoundError(f"Événement {event_id} introuvable")
    return ev


async def create_event(
    db: AsyncSession,
    machine_id: uuid.UUID,
    payload: MachineEventCreate,
    user_id: Optional[uuid.UUID] = None,
) -> MachineEvent:
    # Vérifier que la machine existe
    m = await db.execute(select(Machine).where(Machine.id == machine_id))
    if not m.scalar_one_or_none():
        raise NotFoundError(f"Machine {machine_id} introuvable")

    ev = MachineEvent(
        machine_id=machine_id,
        created_by=user_id,
        **payload.model_dump(),
    )
    db.add(ev)
    await db.flush()
    return ev


async def update_event(
    db: AsyncSession,
    event_id: uuid.UUID,
    payload: MachineEventUpdate,
) -> MachineEvent:
    ev = await get_event(db, event_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(ev, k, v)
    await db.flush()
    return ev


async def delete_event(db: AsyncSession, event_id: uuid.UUID) -> None:
    ev = await get_event(db, event_id)
    await db.delete(ev)
    await db.flush()


# ═══════════════════════════════════════════════════════
# INTERVENTIONS
# ═══════════════════════════════════════════════════════

async def create_intervention(
    db: AsyncSession,
    event_id: uuid.UUID,
    payload: InterventionCreate,
    user_id: Optional[uuid.UUID] = None,
) -> Intervention:
    ev = await get_event(db, event_id)
    intervention = Intervention(
        event_id=event_id,
        machine_id=ev.machine_id,
        created_by=user_id,
        **payload.model_dump(),
    )
    db.add(intervention)
    await db.flush()
    return intervention


async def delete_intervention(db: AsyncSession, intervention_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Intervention).where(Intervention.id == intervention_id)
    )
    i = result.scalar_one_or_none()
    if not i:
        raise NotFoundError(f"Intervention {intervention_id} introuvable")
    await db.delete(i)
    await db.flush()


# ═══════════════════════════════════════════════════════
# PLANNED MAINTENANCE
# ═══════════════════════════════════════════════════════

async def list_planned(
    db: AsyncSession,
    machine_id: uuid.UUID,
) -> list[PlannedMaintenance]:
    result = await db.execute(
        select(PlannedMaintenance)
        .where(PlannedMaintenance.machine_id == machine_id)
        .order_by(PlannedMaintenance.planned_date)
    )
    return list(result.scalars().all())


async def create_planned(
    db: AsyncSession,
    machine_id: uuid.UUID,
    payload: PlannedMaintenanceCreate,
    user_id: Optional[uuid.UUID] = None,
) -> PlannedMaintenance:
    m = await db.execute(select(Machine).where(Machine.id == machine_id))
    if not m.scalar_one_or_none():
        raise NotFoundError(f"Machine {machine_id} introuvable")
    pm = PlannedMaintenance(
        machine_id=machine_id,
        created_by=user_id,
        **payload.model_dump(),
    )
    db.add(pm)
    await db.flush()
    return pm


async def update_planned(
    db: AsyncSession,
    pm_id: uuid.UUID,
    payload: PlannedMaintenanceUpdate,
) -> PlannedMaintenance:
    result = await db.execute(
        select(PlannedMaintenance).where(PlannedMaintenance.id == pm_id)
    )
    pm = result.scalar_one_or_none()
    if not pm:
        raise NotFoundError(f"Maintenance planifiée {pm_id} introuvable")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(pm, k, v)
    await db.flush()
    return pm


async def delete_planned(db: AsyncSession, pm_id: uuid.UUID) -> None:
    result = await db.execute(
        select(PlannedMaintenance).where(PlannedMaintenance.id == pm_id)
    )
    pm = result.scalar_one_or_none()
    if not pm:
        raise NotFoundError(f"Maintenance planifiée {pm_id} introuvable")
    await db.delete(pm)
    await db.flush()


# ═══════════════════════════════════════════════════════
# TIMELINE — agrégation pour le frontend
# ═══════════════════════════════════════════════════════

async def get_timeline(
    db: AsyncSession,
    machine_id: uuid.UUID,
    days: int = 14,
) -> dict:
    events = await list_events(db, machine_id, days)
    planned = await list_planned(db, machine_id)
    return {"machine_id": machine_id, "events": events, "planned": planned}
