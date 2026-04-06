"""
Routers Phase 4 — Import de configuration et données
"""
import json
import uuid
from typing import List, Dict, Any
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, AdminRequired
from app.db.session import get_db
from app.services.import_service import (
    import_configuration,
    import_machine_events,
    ImportError,
    ValidationError,
)

router = APIRouter(tags=["imports"])
DB = Depends(get_db)


# ═══════════════════════════════════════════════════════
# IMPORT CONFIGURATION
# ═══════════════════════════════════════════════════════

@router.post("/config/import", status_code=201)
async def import_config(
    file: UploadFile = File(...),
    db: AsyncSession = DB,
    _: AdminRequired = None,
):
    """
    Importe une configuration d'usine depuis un fichier JSON.
    Remplace complètement la configuration existante.
    """
    if not file.filename.endswith('.json'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier doit être au format JSON"
        )

    try:
        content = await file.read()
        config_data = json.loads(content.decode('utf-8'))

        result = await import_configuration(db, config_data)

        return {
            "message": "Configuration importée avec succès",
            "imported": result,
        }

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fichier JSON invalide"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Configuration invalide: {str(e)}"
        )
    except ImportError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'import: {str(e)}"
        )


# ═══════════════════════════════════════════════════════
# IMPORT DONNÉES HISTORIQUES
# ═══════════════════════════════════════════════════════

@router.post("/data/import", status_code=201)
async def import_data(
    file: UploadFile = File(...),
    db: AsyncSession = DB,
    _: AdminRequired = None,
):
    """
    Importe des données historiques depuis un fichier JSON.
    Les données sont ajoutées sans remplacer les existantes.
    """
    if not file.filename.endswith('.json'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier doit être au format JSON"
        )

    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))

        result = await import_machine_events(db, data)

        return {
            "message": "Données importées avec succès",
            "imported": result,
        }

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fichier JSON invalide"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Données invalides: {str(e)}"
        )
    except ImportError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'import: {str(e)}"
        )


# ═══════════════════════════════════════════════════════
# IMPORT AUTOMATIQUE (DOSSIER)
# ═══════════════════════════════════════════════════════

@router.post("/data/auto-import", status_code=200)
async def auto_import_data(
    db: AsyncSession = DB,
    _: AdminRequired = None,
):
    """
    Importe automatiquement tous les fichiers JSON du dossier data/incoming/.
    Les fichiers traités sont déplacés vers data/archive/.
    """
    incoming_dir = Path("data/incoming")
    archive_dir = Path("data/archive")

    if not incoming_dir.exists():
        return {"message": "Aucun fichier à importer", "processed": 0}

    archive_dir.mkdir(exist_ok=True)

    processed = 0
    errors = []

    for json_file in incoming_dir.glob("*.json"):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            result = await import_machine_events(db, data)

            # Archiver le fichier
            archive_file = archive_dir / json_file.name
            json_file.rename(archive_file)

            processed += 1

        except Exception as e:
            errors.append({
                "file": json_file.name,
                "error": str(e)
            })

    return {
        "message": f"{processed} fichier(s) traité(s)",
        "processed": processed,
        "errors": errors,
    }


# ═══════════════════════════════════════════════════════
# STATUT DES IMPORTS
# ═══════════════════════════════════════════════════════

@router.get("/status")
async def get_import_status(
    db: AsyncSession = DB,
    _: AdminRequired = None,
):
    """
    Retourne le statut actuel des imports et de la configuration.
    """
    # Compter les éléments dans la base
    from sqlalchemy import select, func
    from app.models.referentiel import Site, Building, Machine
    from app.models.events import MachineEvent

    sites_count = await db.scalar(select(func.count()).select_from(Site))
    buildings_count = await db.scalar(select(func.count()).select_from(Building))
    machines_count = await db.scalar(select(func.count()).select_from(Machine))
    events_count = await db.scalar(select(func.count()).select_from(MachineEvent))

    # Vérifier les fichiers en attente
    incoming_dir = Path("data/incoming")
    pending_files = len(list(incoming_dir.glob("*.json"))) if incoming_dir.exists() else 0

    return {
        "configuration": {
            "sites": sites_count,
            "buildings": buildings_count,
            "machines": machines_count,
        },
        "data": {
            "events": events_count,
        },
        "pending_imports": pending_files,
    }