"""
Routers Phase 2 — Référentiel industriel
GET/POST/PUT/DELETE sur Site, Building, Workshop, Machine
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, SupervisorOrAbove, AdminOnly
from app.db.session import get_db
from app.schemas.referentiel import (
    BuildingCreate, BuildingOut, BuildingUpdate,
    MachineCreate, MachineOut, MachineUpdate,
    SiteCreate, SiteOut, SiteUpdate, SiteWithTree,
    WorkshopCreate, WorkshopOut, WorkshopUpdate,
    MACHINE_TYPES, MACHINE_FUNCTIONS,
)
from app.models.referentiel import MachineStatus
from app.services.referentiel_service import (
    NotFoundError,
    create_building, create_machine, create_site, create_workshop,
    delete_building, delete_machine, delete_site, delete_workshop,
    get_all_sites_tree, get_building, get_machine, get_site, get_site_tree, get_workshop,
    list_all_machines, list_buildings, list_machines, list_sites, list_workshops,
    update_building, update_machine, update_site, update_workshop,
)

router = APIRouter(tags=["referentiel"])

DB = Annotated[AsyncSession, Depends(get_db)]


def _404(e: NotFoundError):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ── Constantes ────────────────────────────────────────────────────────────────

@router.get("/referentiel/constants")
async def get_constants(_: CurrentUser):
    return {
        "machine_types": MACHINE_TYPES,
        "machine_functions": MACHINE_FUNCTIONS,
        "machine_statuses": [s.value for s in MachineStatus],
    }


# ═══════════════════════════════════════════════════════
# SITES
# ═══════════════════════════════════════════════════════

@router.get("/sites", response_model=list[SiteOut])
async def get_sites(db: DB, _: CurrentUser):
    return await list_sites(db)


@router.get("/sites/tree", response_model=list[SiteWithTree])
async def get_sites_tree(db: DB, _: CurrentUser):
    """Retourne l'arbre complet Site→Building→Workshop→Machine en une requête."""
    return await get_all_sites_tree(db)


@router.post("/sites", response_model=SiteOut, status_code=201)
async def post_site(payload: SiteCreate, db: DB, _: AdminOnly):
    return await create_site(db, payload)


@router.get("/sites/{site_id}", response_model=SiteOut)
async def get_site_detail(site_id: uuid.UUID, db: DB, _: CurrentUser):
    try:
        return await get_site(db, site_id)
    except NotFoundError as e:
        _404(e)


@router.get("/sites/{site_id}/tree", response_model=SiteWithTree)
async def get_site_detail_tree(site_id: uuid.UUID, db: DB, _: CurrentUser):
    try:
        return await get_site_tree(db, site_id)
    except NotFoundError as e:
        _404(e)


@router.put("/sites/{site_id}", response_model=SiteOut)
async def put_site(site_id: uuid.UUID, payload: SiteUpdate, db: DB, _: SupervisorOrAbove):
    try:
        return await update_site(db, site_id, payload)
    except NotFoundError as e:
        _404(e)


@router.delete("/sites/{site_id}", status_code=204)
async def del_site(site_id: uuid.UUID, db: DB, _: AdminOnly):
    try:
        await delete_site(db, site_id)
    except NotFoundError as e:
        _404(e)


# ═══════════════════════════════════════════════════════
# BUILDINGS
# ═══════════════════════════════════════════════════════

@router.get("/sites/{site_id}/buildings", response_model=list[BuildingOut])
async def get_buildings(site_id: uuid.UUID, db: DB, _: CurrentUser):
    try:
        return await list_buildings(db, site_id)
    except NotFoundError as e:
        _404(e)


@router.post("/sites/{site_id}/buildings", response_model=BuildingOut, status_code=201)
async def post_building(site_id: uuid.UUID, payload: BuildingCreate, db: DB, _: AdminOnly):
    try:
        return await create_building(db, site_id, payload)
    except NotFoundError as e:
        _404(e)


@router.get("/buildings/{building_id}", response_model=BuildingOut)
async def get_building_detail(building_id: uuid.UUID, db: DB, _: CurrentUser):
    try:
        return await get_building(db, building_id)
    except NotFoundError as e:
        _404(e)


@router.put("/buildings/{building_id}", response_model=BuildingOut)
async def put_building(building_id: uuid.UUID, payload: BuildingUpdate, db: DB, _: SupervisorOrAbove):
    try:
        return await update_building(db, building_id, payload)
    except NotFoundError as e:
        _404(e)


@router.delete("/buildings/{building_id}", status_code=204)
async def del_building(building_id: uuid.UUID, db: DB, _: AdminOnly):
    try:
        await delete_building(db, building_id)
    except NotFoundError as e:
        _404(e)


# ═══════════════════════════════════════════════════════
# WORKSHOPS
# ═══════════════════════════════════════════════════════

@router.get("/buildings/{building_id}/workshops", response_model=list[WorkshopOut])
async def get_workshops(building_id: uuid.UUID, db: DB, _: CurrentUser):
    try:
        return await list_workshops(db, building_id)
    except NotFoundError as e:
        _404(e)


@router.post("/buildings/{building_id}/workshops", response_model=WorkshopOut, status_code=201)
async def post_workshop(building_id: uuid.UUID, payload: WorkshopCreate, db: DB, _: AdminOnly):
    try:
        return await create_workshop(db, building_id, payload)
    except NotFoundError as e:
        _404(e)


@router.get("/workshops/{workshop_id}", response_model=WorkshopOut)
async def get_workshop_detail(workshop_id: uuid.UUID, db: DB, _: CurrentUser):
    try:
        return await get_workshop(db, workshop_id)
    except NotFoundError as e:
        _404(e)


@router.put("/workshops/{workshop_id}", response_model=WorkshopOut)
async def put_workshop(workshop_id: uuid.UUID, payload: WorkshopUpdate, db: DB, _: SupervisorOrAbove):
    try:
        return await update_workshop(db, workshop_id, payload)
    except NotFoundError as e:
        _404(e)


@router.delete("/workshops/{workshop_id}", status_code=204)
async def del_workshop(workshop_id: uuid.UUID, db: DB, _: AdminOnly):
    try:
        await delete_workshop(db, workshop_id)
    except NotFoundError as e:
        _404(e)


# ═══════════════════════════════════════════════════════
# MACHINES
# ═══════════════════════════════════════════════════════

@router.get("/machines", response_model=list[MachineOut])
async def get_all_machines(db: DB, _: CurrentUser):
    return await list_all_machines(db)


@router.get("/workshops/{workshop_id}/machines", response_model=list[MachineOut])
async def get_machines(workshop_id: uuid.UUID, db: DB, _: CurrentUser):
    try:
        return await list_machines(db, workshop_id)
    except NotFoundError as e:
        _404(e)


@router.post("/workshops/{workshop_id}/machines", response_model=MachineOut, status_code=201)
async def post_machine(workshop_id: uuid.UUID, payload: MachineCreate, db: DB, _: SupervisorOrAbove):
    try:
        return await create_machine(db, workshop_id, payload)
    except NotFoundError as e:
        _404(e)


@router.get("/machines/{machine_id}", response_model=MachineOut)
async def get_machine_detail(machine_id: uuid.UUID, db: DB, _: CurrentUser):
    try:
        return await get_machine(db, machine_id)
    except NotFoundError as e:
        _404(e)


@router.put("/machines/{machine_id}", response_model=MachineOut)
async def put_machine(machine_id: uuid.UUID, payload: MachineUpdate, db: DB, _: CurrentUser):
    try:
        return await update_machine(db, machine_id, payload)
    except NotFoundError as e:
        _404(e)


@router.delete("/machines/{machine_id}", status_code=204)
async def del_machine(machine_id: uuid.UUID, db: DB, _: SupervisorOrAbove):
    try:
        await delete_machine(db, machine_id)
    except NotFoundError as e:
        _404(e)
