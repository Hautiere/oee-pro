import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.referentiel import MachineStatus

# ── Constantes du prototype ────────────────────────────────────────────────────
MACHINE_TYPES = [
    "CNC Lathe", "Machining Center", "Hydraulic Press", "Welding Robot",
    "Conveyor", "Industrial Oven", "Compressor", "Pump", "Mixer",
    "Assembly Line", "Vision Inspection", "Laser Cutter", "Drill",
    "Milling Machine", "Grinder", "Extruder", "Injection Molder", "Other",
]
MACHINE_FUNCTIONS = [
    "Machining", "Assembly", "Welding", "Quality Control",
    "Material Handling", "Heat Treatment", "Packaging",
    "Test & Validation", "Traceability", "Cleaning",
    "Energy Production", "Other",
]


# ═══════════════════════════════════════════════════════
# SITE
# ═══════════════════════════════════════════════════════

class SiteCreate(BaseModel):
    name: str
    description: Optional[str] = None
    address: Optional[str] = None
    manager: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = "Europe/Paris"


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    manager: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None


class SiteOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    name: str
    description: Optional[str]
    address: Optional[str]
    manager: Optional[str]
    country: Optional[str]
    timezone: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════
# BUILDING
# ═══════════════════════════════════════════════════════

class BuildingCreate(BaseModel):
    name: str
    description: Optional[str] = None
    floors: Optional[int] = None
    surface: Optional[float] = None
    manager: Optional[str] = None


class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    floors: Optional[int] = None
    surface: Optional[float] = None
    manager: Optional[str] = None
    is_active: Optional[bool] = None


class BuildingOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    site_id: uuid.UUID
    name: str
    description: Optional[str]
    floors: Optional[int]
    surface: Optional[float]
    manager: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════
# WORKSHOP
# ═══════════════════════════════════════════════════════

class OEEThreshold(BaseModel):
    good: float = 0.85
    warn: float = 0.65


class WorkshopCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    responsible: Optional[str] = None
    oee_threshold_good: float = 0.85
    oee_threshold_warn: float = 0.65


class WorkshopUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    responsible: Optional[str] = None
    oee_threshold_good: Optional[float] = None
    oee_threshold_warn: Optional[float] = None
    is_active: Optional[bool] = None


class WorkshopOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    building_id: uuid.UUID
    name: str
    description: Optional[str]
    location: Optional[str]
    responsible: Optional[str]
    oee_threshold_good: float
    oee_threshold_warn: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════
# MACHINE
# ═══════════════════════════════════════════════════════

class MachineCreate(BaseModel):
    name: str
    machine_type: str = "Other"
    machine_function: str = "Other"
    status: MachineStatus = MachineStatus.idle
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    year_installed: Optional[int] = None
    cadence_ref: int = 0
    notes: Optional[str] = None
    tags: list[str] = []


class MachineUpdate(BaseModel):
    name: Optional[str] = None
    machine_type: Optional[str] = None
    machine_function: Optional[str] = None
    status: Optional[MachineStatus] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    year_installed: Optional[int] = None
    cadence_ref: Optional[int] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    is_active: Optional[bool] = None


class MachineOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    workshop_id: uuid.UUID
    name: str
    machine_type: str
    machine_function: str
    status: MachineStatus
    serial_number: Optional[str]
    manufacturer: Optional[str]
    year_installed: Optional[int]
    cadence_ref: int
    notes: Optional[str]
    tags: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════
# RÉPONSES IMBRIQUÉES (pour l'arbre complet)
# ═══════════════════════════════════════════════════════

class WorkshopWithMachines(WorkshopOut):
    machines: list[MachineOut] = []

class BuildingWithWorkshops(BuildingOut):
    workshops: list[WorkshopWithMachines] = []

class SiteWithTree(SiteOut):
    buildings: list[BuildingWithWorkshops] = []
