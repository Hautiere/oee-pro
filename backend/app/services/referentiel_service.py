"""
Service référentiel — logique métier découplée de FastAPI.
Gère les opérations CRUD sur Site, Building, Workshop, Machine.
"""
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.referentiel import Building, Machine, MachineStatus, Site, Workshop
from app.schemas.referentiel import (
    BuildingCreate, BuildingUpdate,
    MachineCreate, MachineUpdate,
    SiteCreate, SiteUpdate,
    WorkshopCreate, WorkshopUpdate,
)


class NotFoundError(Exception):
    pass


# ═══════════════════════════════════════════════════════
# SITE
# ═══════════════════════════════════════════════════════

async def list_sites(db: AsyncSession) -> list[Site]:
    result = await db.execute(select(Site).where(Site.is_active == True).order_by(Site.name))
    return list(result.scalars().all())


async def get_site(db: AsyncSession, site_id: uuid.UUID) -> Site:
    result = await db.execute(select(Site).where(Site.id == site_id))
    site = result.scalar_one_or_none()
    if not site:
        raise NotFoundError(f"Site {site_id} introuvable")
    return site


async def get_site_tree(db: AsyncSession, site_id: uuid.UUID) -> Site:
    result = await db.execute(
        select(Site)
        .where(Site.id == site_id)
        .options(
            selectinload(Site.buildings)
            .selectinload(Building.workshops)
            .selectinload(Workshop.machines)
        )
    )
    site = result.scalar_one_or_none()
    if not site:
        raise NotFoundError(f"Site {site_id} introuvable")
    return site


async def get_all_sites_tree(db: AsyncSession) -> list[Site]:
    result = await db.execute(
        select(Site)
        .where(Site.is_active == True)
        .options(
            selectinload(Site.buildings)
            .selectinload(Building.workshops)
            .selectinload(Workshop.machines)
        )
        .order_by(Site.name)
    )
    return list(result.scalars().all())


async def create_site(db: AsyncSession, payload: SiteCreate) -> Site:
    site = Site(**payload.model_dump())
    db.add(site)
    await db.flush()
    return site


async def update_site(db: AsyncSession, site_id: uuid.UUID, payload: SiteUpdate) -> Site:
    site = await get_site(db, site_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(site, k, v)
    await db.flush()
    return site


async def delete_site(db: AsyncSession, site_id: uuid.UUID) -> None:
    site = await get_site(db, site_id)
    site.is_active = False
    await db.flush()


# ═══════════════════════════════════════════════════════
# BUILDING
# ═══════════════════════════════════════════════════════

async def list_buildings(db: AsyncSession, site_id: uuid.UUID) -> list[Building]:
    await get_site(db, site_id)
    result = await db.execute(
        select(Building).where(Building.site_id == site_id, Building.is_active == True).order_by(Building.name)
    )
    return list(result.scalars().all())


async def get_building(db: AsyncSession, building_id: uuid.UUID) -> Building:
    result = await db.execute(select(Building).where(Building.id == building_id))
    b = result.scalar_one_or_none()
    if not b:
        raise NotFoundError(f"Building {building_id} introuvable")
    return b


async def create_building(db: AsyncSession, site_id: uuid.UUID, payload: BuildingCreate) -> Building:
    await get_site(db, site_id)
    b = Building(site_id=site_id, **payload.model_dump())
    db.add(b)
    await db.flush()
    return b


async def update_building(db: AsyncSession, building_id: uuid.UUID, payload: BuildingUpdate) -> Building:
    b = await get_building(db, building_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(b, k, v)
    await db.flush()
    return b


async def delete_building(db: AsyncSession, building_id: uuid.UUID) -> None:
    b = await get_building(db, building_id)
    b.is_active = False
    await db.flush()


# ═══════════════════════════════════════════════════════
# WORKSHOP
# ═══════════════════════════════════════════════════════

async def list_workshops(db: AsyncSession, building_id: uuid.UUID) -> list[Workshop]:
    await get_building(db, building_id)
    result = await db.execute(
        select(Workshop).where(Workshop.building_id == building_id, Workshop.is_active == True).order_by(Workshop.name)
    )
    return list(result.scalars().all())


async def get_workshop(db: AsyncSession, workshop_id: uuid.UUID) -> Workshop:
    result = await db.execute(select(Workshop).where(Workshop.id == workshop_id))
    w = result.scalar_one_or_none()
    if not w:
        raise NotFoundError(f"Workshop {workshop_id} introuvable")
    return w


async def create_workshop(db: AsyncSession, building_id: uuid.UUID, payload: WorkshopCreate) -> Workshop:
    await get_building(db, building_id)
    w = Workshop(building_id=building_id, **payload.model_dump())
    db.add(w)
    await db.flush()
    return w


async def update_workshop(db: AsyncSession, workshop_id: uuid.UUID, payload: WorkshopUpdate) -> Workshop:
    w = await get_workshop(db, workshop_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(w, k, v)
    await db.flush()
    return w


async def delete_workshop(db: AsyncSession, workshop_id: uuid.UUID) -> None:
    w = await get_workshop(db, workshop_id)
    w.is_active = False
    await db.flush()


# ═══════════════════════════════════════════════════════
# MACHINE
# ═══════════════════════════════════════════════════════

async def list_machines(db: AsyncSession, workshop_id: uuid.UUID) -> list[Machine]:
    await get_workshop(db, workshop_id)
    result = await db.execute(
        select(Machine).where(Machine.workshop_id == workshop_id, Machine.is_active == True).order_by(Machine.name)
    )
    return list(result.scalars().all())


async def list_all_machines(db: AsyncSession) -> list[Machine]:
    result = await db.execute(
        select(Machine).where(Machine.is_active == True).order_by(Machine.name)
    )
    return list(result.scalars().all())


async def get_machine(db: AsyncSession, machine_id: uuid.UUID) -> Machine:
    result = await db.execute(select(Machine).where(Machine.id == machine_id))
    m = result.scalar_one_or_none()
    if not m:
        raise NotFoundError(f"Machine {machine_id} introuvable")
    return m


async def create_machine(db: AsyncSession, workshop_id: uuid.UUID, payload: MachineCreate) -> Machine:
    await get_workshop(db, workshop_id)
    m = Machine(workshop_id=workshop_id, **payload.model_dump())
    db.add(m)
    await db.flush()
    return m


async def update_machine(db: AsyncSession, machine_id: uuid.UUID, payload: MachineUpdate) -> Machine:
    m = await get_machine(db, machine_id)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    await db.flush()
    return m


async def delete_machine(db: AsyncSession, machine_id: uuid.UUID) -> None:
    m = await get_machine(db, machine_id)
    m.is_active = False
    await db.flush()
