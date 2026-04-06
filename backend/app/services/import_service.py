"""
Services d'import — Configuration et données
"""
import uuid
from typing import Dict, Any, List
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.referentiel import Site, Building, Machine
from app.models.events import MachineEvent
from app.services.referentiel_service import create_site, create_building, create_machine
from app.services.events_service import create_event


class ImportError(Exception):
    """Erreur générale d'import"""
    pass


class ValidationError(Exception):
    """Erreur de validation des données"""
    pass


# ═══════════════════════════════════════════════════════
# VALIDATION
# ═══════════════════════════════════════════════════════

def validate_config_structure(config: Dict[str, Any]) -> None:
    """Valide la structure du fichier de configuration"""
    required_keys = ["version", "sites"]
    for key in required_keys:
        if key not in config:
            raise ValidationError(f"Clé requise manquante: {key}")

    if not isinstance(config["sites"], list):
        raise ValidationError("La clé 'sites' doit être une liste")

    for site in config["sites"]:
        if not isinstance(site, dict):
            raise ValidationError("Chaque site doit être un objet")
        if "name" not in site:
            raise ValidationError("Chaque site doit avoir un nom")
        if "buildings" in site:
            for building in site["buildings"]:
                if "workshops" in building:
                    for workshop in building["workshops"]:
                        if "machines" in workshop:
                            for machine in workshop["machines"]:
                                required_machine_keys = ["name", "type"]
                                for key in required_machine_keys:
                                    if key not in machine:
                                        raise ValidationError(f"Machine sans clé requise: {key}")


def validate_data_structure(data: Dict[str, Any]) -> None:
    """Valide la structure du fichier de données"""
    required_keys = ["version", "machines"]
    for key in required_keys:
        if key not in data:
            raise ValidationError(f"Clé requise manquante: {key}")

    if not isinstance(data["machines"], list):
        raise ValidationError("La clé 'machines' doit être une liste")

    for machine_data in data["machines"]:
        if not isinstance(machine_data, dict):
            raise ValidationError("Chaque machine doit être un objet")
        if "machine_name" not in machine_data:
            raise ValidationError("Chaque machine doit avoir un nom")
        if "events" not in machine_data:
            raise ValidationError("Chaque machine doit avoir des événements")

        for event in machine_data["events"]:
            required_event_keys = ["event_type", "started_at"]
            for key in required_event_keys:
                if key not in event:
                    raise ValidationError(f"Événement sans clé requise: {key}")


# ═══════════════════════════════════════════════════════
# IMPORT CONFIGURATION
# ═══════════════════════════════════════════════════════

async def import_configuration(db: AsyncSession, config: Dict[str, Any]) -> Dict[str, int]:
    """
    Importe une configuration complète d'usine.
    Remplace toute configuration existante.
    """
    validate_config_structure(config)

    # Supprimer la configuration existante
    await db.execute(delete(Machine))
    await db.execute(delete(Building))
    await db.execute(delete(Site))
    await db.commit()

    imported = {"sites": 0, "buildings": 0, "machines": 0}

    try:
        for site_data in config["sites"]:
            # Créer le site
            site = await create_site(db, {
                "name": site_data["name"],
                "location": site_data.get("location", ""),
            })
            imported["sites"] += 1

            for building_data in site_data.get("buildings", []):
                # Créer le bâtiment
                building = await create_building(db, site.id, {
                    "name": building_data["name"],
                })
                imported["buildings"] += 1

                for workshop_data in building_data.get("workshops", []):
                    for machine_data in workshop_data.get("machines", []):
                        # Créer la machine
                        await create_machine(db, building.id, {
                            "name": machine_data["name"],
                            "machine_type": machine_data["type"],
                            "status": machine_data.get("status", "idle"),
                            "description": machine_data.get("description", ""),
                            "tags": machine_data.get("tags", []),
                        })
                        imported["machines"] += 1

        await db.commit()
        return imported

    except Exception as e:
        await db.rollback()
        raise ImportError(f"Erreur lors de l'import de la configuration: {str(e)}")


# ═══════════════════════════════════════════════════════
# IMPORT DONNÉES HISTORIQUES
# ═══════════════════════════════════════════════════════

async def import_machine_events(db: AsyncSession, data: Dict[str, Any]) -> Dict[str, int]:
    """
    Importe des événements machine depuis un fichier de données.
    Les données sont ajoutées sans remplacer les existantes.
    """
    validate_data_structure(data)

    imported = {"machines": 0, "events": 0}

    try:
        for machine_data in data["machines"]:
            machine_name = machine_data["machine_name"]

            # Trouver la machine par nom
            machine_result = await db.execute(
                select(Machine).where(Machine.name == machine_name)
            )
            machine = machine_result.scalar_one_or_none()

            if not machine:
                raise ValidationError(f"Machine non trouvée: {machine_name}")

            imported["machines"] += 1

            for event_data in machine_data["events"]:
                # Créer l'événement
                await create_event(db, machine.id, {
                    "event_type": event_data["event_type"],
                    "started_at": event_data["started_at"],
                    "ended_at": event_data.get("ended_at"),
                    "quality_pct": event_data.get("quality_pct"),
                    "note": event_data.get("note"),
                }, None)  # Pas d'utilisateur pour les imports

                imported["events"] += 1

        await db.commit()
        return imported

    except Exception as e:
        await db.rollback()
        if isinstance(e, ValidationError):
            raise
        raise ImportError(f"Erreur lors de l'import des données: {str(e)}")


# ═══════════════════════════════════════════════════════
# UTILITAIRES
# ═══════════════════════════════════════════════════════

def get_machine_by_name(db: AsyncSession, name: str) -> Machine:
    """Trouve une machine par son nom"""
    result = db.execute(select(Machine).where(Machine.name == name))
    return result.scalar_one_or_none()


def validate_event_types(events: List[Dict[str, Any]]) -> None:
    """Valide que les types d'événements sont corrects"""
    valid_types = ["running", "idle", "down", "maint"]
    for event in events:
        if event["event_type"] not in valid_types:
            raise ValidationError(f"Type d'événement invalide: {event['event_type']}")