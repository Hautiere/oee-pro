#!/usr/bin/env python3
"""
machine_simulator.py — Simulateur de données machine OEE Pro

Usage (depuis oee-pro/) :
    python simulator/machine_simulator.py
    python simulator/machine_simulator.py --days 30
    python simulator/machine_simulator.py --machine-id <uuid>
"""

import argparse
import asyncio
import json
import math
import os
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

# ── Résolution des chemins ────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).resolve().parent        # oee-pro/simulator/
BACKEND_DIR = SCRIPT_DIR.parent / "backend"          # oee-pro/backend/

# 1. Se placer dans backend/ pour que pydantic-settings lise le bon .env
os.chdir(BACKEND_DIR)

# 2. Ajouter backend/ au path Python
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# 3. Maintenant on peut importer l'app
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.referentiel import Machine


# ─── Profils machine ───────────────────────────────────────────────────────────

MACHINE_PROFILES = {
    "high": {
        "run_ratio": 0.78, "idle_ratio": 0.10, "down_ratio": 0.06, "maint_ratio": 0.06,
        "quality_mean": 95, "quality_std": 3,
        "run_min": 45, "run_max": 240, "down_min": 15, "down_max": 60,
    },
    "medium": {
        "run_ratio": 0.65, "idle_ratio": 0.15, "down_ratio": 0.12, "maint_ratio": 0.08,
        "quality_mean": 88, "quality_std": 6,
        "run_min": 30, "run_max": 180, "down_min": 20, "down_max": 90,
    },
    "degraded": {
        "run_ratio": 0.45, "idle_ratio": 0.15, "down_ratio": 0.28, "maint_ratio": 0.12,
        "quality_mean": 78, "quality_std": 10,
        "run_min": 20, "run_max": 120, "down_min": 30, "down_max": 180,
    },
}

PROFILE_BY_TYPE = {
    "CNC Lathe": "medium", "Machining Center": "high", "Milling Machine": "medium",
    "Welding Robot": "high", "Hydraulic Press": "degraded", "Conveyor": "high",
    "Assembly Line": "high", "Vision Inspection": "high", "Industrial Oven": "medium",
    "Injection Molder": "medium", "Laser Cutter": "high", "Other": "medium",
}

DOWN_CAUSES = {
    "CNC Lathe":        ["Casse outil", "Changement série", "Défaut programme"],
    "Machining Center": ["Changement outil", "Métrologie", "Setup"],
    "Hydraulic Press":  ["Fuite huile", "Défaut pression", "Changement matrice"],
    "Welding Robot":    ["Calibration TCP", "Changement fil", "Défaut capteur arc"],
    "Conveyor":         ["Bourrage", "Défaut capteur", "Maintenance préventive"],
    "Assembly Line":    ["Manque composant", "Défaut qualité", "Changement référence"],
    "Injection Molder": ["Changement moule", "Purge matière", "Défaut éjecteur"],
    "Laser Cutter":     ["Changement lentille", "Nettoyage optique", "Calibration"],
    "default":          ["Arrêt non planifié", "Intervention opérateur", "Défaut détecté"],
}


def rng_seed(s: float, seed: float) -> float:
    x = math.sin(s + seed) * 10000
    return x - math.floor(x)


def simulate_machine(machine_id, machine_name, machine_type, machine_status, days=14, seed=None):
    end_date   = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    if seed is None:
        seed = hash(machine_id) % 10000

    profile_name = "degraded" if machine_status == "down" else PROFILE_BY_TYPE.get(machine_type, "medium")
    profile = MACHINE_PROFILES[profile_name]

    run_thresh  = profile["run_ratio"]
    idle_thresh = run_thresh + profile["idle_ratio"]
    down_thresh = idle_thresh + profile["down_ratio"]

    events  = []
    elapsed = 0
    total   = days * 16 * 60  # 16h/jour
    i       = 0

    while elapsed < total:
        r = rng_seed(i, seed); i += 1
        if   r < run_thresh:   etype, dmin, dmax = "running", profile["run_min"],  profile["run_max"]
        elif r < idle_thresh:  etype, dmin, dmax = "idle",    10,                  45
        elif r < down_thresh:  etype, dmin, dmax = "down",    profile["down_min"], profile["down_max"]
        else:                  etype, dmin, dmax = "maint",   30,                  120

        dur = int(dmin + rng_seed(i, seed) * (dmax - dmin)); i += 1
        dur = min(dur, total - elapsed)

        if etype == "running":
            q = int(min(100, max(50, profile["quality_mean"] + (rng_seed(i, seed) - 0.5) * 2 * profile["quality_std"])))
        else:
            q = 0
        i += 1

        note = random.choice(DOWN_CAUSES.get(machine_type, DOWN_CAUSES["default"])) if etype == "down" else None

        events.append({
            "event_type":  etype,
            "started_at":  (start_date + timedelta(minutes=elapsed)).isoformat(),
            "ended_at":    (start_date + timedelta(minutes=elapsed + dur)).isoformat(),
            "quality_pct": q,
            "note":        note,
        })
        elapsed += dur

    return {
        "machine_id":   machine_id,
        "machine_name": machine_name,
        "machine_type": machine_type,
        "profile":      profile_name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period_start": start_date.isoformat(),
        "period_end":   end_date.isoformat(),
        "days":         days,
        "event_count":  len(events),
        "events":       events,
    }


async def fetch_machines(machine_id=None):
    async with AsyncSessionLocal() as db:
        q = select(Machine).where(Machine.is_active == True)
        if machine_id:
            q = q.where(Machine.id == machine_id)
        result = await db.execute(q)
        return [
            {"id": str(m.id), "name": m.name, "type": m.machine_type, "status": m.status.value}
            for m in result.scalars().all()
        ]


async def run(days, output_dir, machine_id=None):
    print(f"\n{'='*56}")
    print(f"  OEE Pro — Simulateur machine — {days} jours")
    print(f"{'='*56}\n")

    machines = await fetch_machines(machine_id)
    if not machines:
        print("  ✗ Aucune machine — lancer d'abord seed_referentiel.py")
        return

    print(f"  ✓ {len(machines)} machine(s) trouvée(s)\n")

    # output_dir est relatif au répertoire d'appel original, pas backend/
    # On reconstruit le chemin absolu depuis SCRIPT_DIR
    out = (SCRIPT_DIR.parent / output_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")

    all_data = []
    for m in machines:
        data = simulate_machine(m["id"], m["name"], m["type"], m["status"], days)
        all_data.append(data)
        print(f"  ⚙  {m['name']:40s} → {data['event_count']:4d} evt · profil: {data['profile']}")

    payload = {
        "simulation_id": str(uuid.uuid4()),
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "days":          days,
        "machine_count": len(all_data),
        "total_events":  sum(d["event_count"] for d in all_data),
        "schema": {
            "note":        "Compatible POST /api/v1/machines/{machine_id}/events",
            "event_types": ["running", "idle", "down", "maint"],
            "quality_pct": "0-100, pertinent uniquement pour event_type=running",
        },
        "machines": all_data,
    }

    out_file = out / f"simulation_{today}_{days}j.json"
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    print(f"\n  ✓ {out_file}")
    print(f"  ✓ {payload['total_events']} événements au total")
    print(f"\n  Prochaine étape :")
    print(f"  python simulator/api_connector.py --file simulator/data/simulation_{today}_{days}j.json\n")
    return out_file


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days",       type=int, default=14)
    parser.add_argument("--output",     default="simulator/data")
    parser.add_argument("--machine-id", default=None)
    args = parser.parse_args()
    asyncio.run(run(args.days, args.output, args.machine_id))


if __name__ == "__main__":
    main()
