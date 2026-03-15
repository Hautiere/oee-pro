#!/usr/bin/env python3
"""
Seed Phase 3 — Événements machine de démo (14 jours)
Reproduit la logique genEvents() du prototype React.

    python scripts/seed_events.py
"""
import asyncio, sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone, timedelta
from sqlalchemy import select, text
from app.db.session import AsyncSessionLocal
from app.models.events import EventType, MachineEvent, Intervention, MaintType, PlannedMaintenance
from app.models.referentiel import Machine


def gen_events_for_machine(machine_id, seed: int, day_count: int = 14):
    """Reproduit genEvents() du prototype — déterministe par seed."""
    def rng(s):
        x = math.sin(s + seed) * 10000
        return x - math.floor(x)

    events = []
    base = datetime(2025, 2, 1, tzinfo=timezone.utc)
    cursor = 0
    i = 0
    total = day_count * 480  # minutes

    while cursor < total:
        r = rng(i); i += 1
        if r < 0.65:   etype = EventType.running
        elif r < 0.78: etype = EventType.idle
        elif r < 0.90: etype = EventType.down
        else:          etype = EventType.maint

        min_d = {"running":60,"idle":15,"down":20,"maint":30}[etype.value]
        max_d = {"running":240,"idle":60,"down":120,"maint":180}[etype.value]
        dur = round(min_d + rng(i) * (max_d - min_d)); i += 1

        started_at = base + timedelta(minutes=cursor)
        ended_at   = base + timedelta(minutes=min(cursor + dur, total))
        quality    = round(85 + rng(i) * 14) if etype == EventType.running else 100; i += 1

        events.append({
            "machine_id":  machine_id,
            "event_type":  etype,
            "started_at":  started_at,
            "ended_at":    ended_at,
            "quality_pct": quality,
            "note":        "",
        })
        cursor += dur

    return events


# Seeds du prototype (mkM 4ème arg)
MACHINE_SEEDS = {
    "CNC Lathe Fanuc 300i":   42,
    "5-Axis DMG UGV Center":  17,
    "Maho 700 Mill":          91,
    "ABB IRB 2600 Robot":     55,
    "200T Hydraulic Press":   33,
    "Knapp Conveyor":         77,
    "Juki SMT Line":          64,
    "Cognex AOI IS7402":      28,
    "Heller Reflow Oven":     83,
    "Arburg 720S":            11,
    "KraussMaffei 150T":       6,
    "Trumpf 5000 CO2 Laser":  99,
}

INTERVENTIONS_DEMO = [
    {"cause": "Casse outil #4", "action": "Remplacement outil + réglage", "technician": "P. Bernard", "duration_min": 45},
    {"cause": "Fuite huile hydraulique", "action": "Remplacement joint + purge", "technician": "P. Bernard", "duration_min": 120},
    {"cause": "Ejector cylinder failure", "action": "Remplacement vérin éjecteur", "technician": "P. Bernard", "duration_min": 180},
    {"cause": "Belt wear sector 3", "action": "Remplacement courroie", "technician": "P. Bernard", "duration_min": 60},
]


async def seed():
    async with AsyncSessionLocal() as db:
        # Vérifier si déjà seedé
        count = await db.execute(text("SELECT COUNT(*) FROM machine_events"))
        if count.scalar() > 0:
            print("  ⏭  Événements déjà présents — seed ignoré")
            return

        machines = await db.execute(select(Machine))
        machines = machines.scalars().all()

        total_events = 0
        total_interventions = 0

        for machine in machines:
            seed_val = MACHINE_SEEDS.get(machine.name, 50)
            events_data = gen_events_for_machine(machine.id, seed_val)

            for ed in events_data:
                ev = MachineEvent(**ed)
                db.add(ev)
                total_events += 1

            # Ajouter une intervention sur le 1er événement "down"
            first_down = next((e for e in events_data if e["event_type"] == EventType.down), None)
            if first_down and machine.name in [d["cause"].split()[0] for d in INTERVENTIONS_DEMO]:
                pass  # géré après flush

            # Maintenance planifiée — une dans les 30 prochains jours
            pm = PlannedMaintenance(
                machine_id=machine.id,
                planned_date=datetime(2025, 3, 1, 8, 0, tzinfo=timezone.utc) + timedelta(days=hash(machine.name) % 28),
                duration_min=120,
                maint_type=MaintType.maint,
                reason="Maintenance préventive trimestrielle",
                is_done=False,
            )
            db.add(pm)

        await db.flush()

        # Interventions sur les arrêts des machines en panne
        for machine in machines:
            if machine.status.value == "down":
                result = await db.execute(
                    select(MachineEvent)
                    .where(MachineEvent.machine_id == machine.id,
                           MachineEvent.event_type == EventType.down)
                    .order_by(MachineEvent.started_at.desc())
                    .limit(1)
                )
                ev = result.scalar_one_or_none()
                if ev:
                    interv = Intervention(
                        event_id=ev.id,
                        machine_id=machine.id,
                        cause="Défaillance mécanique",
                        action="Diagnostic en cours — pièce commandée",
                        technician="P. Bernard",
                        duration_min=None,
                    )
                    db.add(interv)
                    total_interventions += 1

        await db.commit()
        print(f"  → {total_events} événements créés")
        print(f"  → {total_interventions} interventions créées")
        print(f"  → {len(machines)} maintenances planifiées")
        print("Seed événements terminé.")


if __name__ == "__main__":
    asyncio.run(seed())
