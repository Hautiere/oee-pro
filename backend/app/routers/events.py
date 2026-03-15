"""
Routers Phase 3 — Événements, interventions, maintenance planifiée
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, MaintenanceOrAbove
from app.db.session import get_db
from app.schemas.events import (
    InterventionCreate, InterventionOut,
    MachineEventCreate, MachineEventOut, MachineEventUpdate,
    PlannedMaintenanceCreate, PlannedMaintenanceOut, PlannedMaintenanceUpdate,
    TimelineResponse,
)
from app.services.events_service import (
    NotFoundError,
    create_event, create_intervention, create_planned,
    delete_event, delete_intervention, delete_planned,
    get_event, get_timeline, list_events, list_planned,
    update_event, update_planned,
)

router = APIRouter(tags=["events"])
DB = Annotated[AsyncSession, Depends(get_db)]


def _404(e: NotFoundError):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ═══════════════════════════════════════════════════════
# TIMELINE — endpoint principal pour le frontend
# ═══════════════════════════════════════════════════════

@router.get("/machines/{machine_id}/timeline", response_model=TimelineResponse)
async def get_machine_timeline(
    machine_id: uuid.UUID,
    db: DB,
    _: CurrentUser,
    days: int = Query(default=14, ge=1, le=90),
):
    """Retourne événements + maintenance planifiée pour la timeline frontend."""
    try:
        result = await get_timeline(db, machine_id, days)
        return result
    except NotFoundError as e:
        _404(e)


# ═══════════════════════════════════════════════════════
# EVENTS
# ═══════════════════════════════════════════════════════

@router.get("/machines/{machine_id}/events", response_model=list[MachineEventOut])
async def get_events(
    machine_id: uuid.UUID,
    db: DB,
    _: CurrentUser,
    days: int = Query(default=14, ge=1, le=90),
):
    try:
        return await list_events(db, machine_id, days)
    except NotFoundError as e:
        _404(e)


@router.post("/machines/{machine_id}/events", response_model=MachineEventOut, status_code=201)
async def post_event(
    machine_id: uuid.UUID,
    payload: MachineEventCreate,
    db: DB,
    current: CurrentUser,
):
    """Déclarer un événement (opérateur, PLC, SCADA)."""
    try:
        ev = await create_event(db, machine_id, payload, current.id)
        return await get_event(db, ev.id)
    except NotFoundError as e:
        _404(e)


@router.put("/events/{event_id}", response_model=MachineEventOut)
async def put_event(
    event_id: uuid.UUID,
    payload: MachineEventUpdate,
    db: DB,
    _: CurrentUser,
):
    try:
        ev = await update_event(db, event_id, payload)
        return await get_event(db, ev.id)
    except NotFoundError as e:
        _404(e)


@router.delete("/events/{event_id}", status_code=204)
async def del_event(
    event_id: uuid.UUID,
    db: DB,
    _: MaintenanceOrAbove,
):
    try:
        await delete_event(db, event_id)
    except NotFoundError as e:
        _404(e)


# ═══════════════════════════════════════════════════════
# INTERVENTIONS
# ═══════════════════════════════════════════════════════

@router.post("/events/{event_id}/interventions", response_model=InterventionOut, status_code=201)
async def post_intervention(
    event_id: uuid.UUID,
    payload: InterventionCreate,
    db: DB,
    current: CurrentUser,
):
    try:
        return await create_intervention(db, event_id, payload, current.id)
    except NotFoundError as e:
        _404(e)


@router.delete("/interventions/{intervention_id}", status_code=204)
async def del_intervention(
    intervention_id: uuid.UUID,
    db: DB,
    _: MaintenanceOrAbove,
):
    try:
        await delete_intervention(db, intervention_id)
    except NotFoundError as e:
        _404(e)


# ═══════════════════════════════════════════════════════
# PLANNED MAINTENANCE
# ═══════════════════════════════════════════════════════

@router.get("/machines/{machine_id}/planned-maintenance", response_model=list[PlannedMaintenanceOut])
async def get_planned(machine_id: uuid.UUID, db: DB, _: CurrentUser):
    try:
        return await list_planned(db, machine_id)
    except NotFoundError as e:
        _404(e)


@router.post("/machines/{machine_id}/planned-maintenance", response_model=PlannedMaintenanceOut, status_code=201)
async def post_planned(
    machine_id: uuid.UUID,
    payload: PlannedMaintenanceCreate,
    db: DB,
    current: CurrentUser,
):
    try:
        return await create_planned(db, machine_id, payload, current.id)
    except NotFoundError as e:
        _404(e)


@router.put("/planned-maintenance/{pm_id}", response_model=PlannedMaintenanceOut)
async def put_planned(
    pm_id: uuid.UUID,
    payload: PlannedMaintenanceUpdate,
    db: DB,
    _: MaintenanceOrAbove,
):
    try:
        return await update_planned(db, pm_id, payload)
    except NotFoundError as e:
        _404(e)


@router.delete("/planned-maintenance/{pm_id}", status_code=204)
async def del_planned(
    pm_id: uuid.UUID,
    db: DB,
    _: MaintenanceOrAbove,
):
    try:
        await delete_planned(db, pm_id)
    except NotFoundError as e:
        _404(e)
