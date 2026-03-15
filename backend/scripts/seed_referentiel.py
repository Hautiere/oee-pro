#!/usr/bin/env python3
"""
Seed Phase 2 — Référentiel industriel
Charge les 3 sites, 4 bâtiments, 6 ateliers et 12 machines du prototype.

    python scripts/seed_referentiel.py
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, text
from app.db.session import AsyncSessionLocal
from app.models.referentiel import Building, Machine, MachineStatus, Site, Workshop

# ─── Données du prototype MachineConfig.jsx ───────────────────────────────────
DEMO = [
  {
    "name": "Lyon Plant — Confluence",
    "address": "Lyon, France", "country": "France", "timezone": "Europe/Paris",
    "buildings": [
      {
        "name": "Building A — Production",
        "workshops": [
          {
            "name": "Machining Workshop",
            "machines": [
              {"name":"CNC Lathe Fanuc 300i",    "machine_type":"CNC Lathe",       "machine_function":"Machining",         "status":"running", "serial_number":"FCN-2019-0442", "manufacturer":"Fanuc",        "year_installed":2019, "cadence_ref":30, "notes":"Tool #4 to replace Q2.",           "tags":["CNC","high-priority"]},
              {"name":"5-Axis DMG UGV Center",   "machine_type":"Machining Center","machine_function":"Machining",         "status":"idle",    "serial_number":"DMG-2021-1187", "manufacturer":"DMG Mori",     "year_installed":2021, "cadence_ref":25, "notes":"Waiting for batch B order.",       "tags":["5-axis"]},
              {"name":"Maho 700 Mill",            "machine_type":"Milling Machine", "machine_function":"Machining",         "status":"running", "serial_number":"MAH-2016-0088", "manufacturer":"Maho",         "year_installed":2016, "cadence_ref":20, "notes":"Monitor spindle vibrations.",       "tags":["legacy"]},
            ],
          },
          {
            "name": "Assembly Workshop",
            "machines": [
              {"name":"ABB IRB 2600 Robot",       "machine_type":"Welding Robot",   "machine_function":"Welding",           "status":"running", "serial_number":"ABB-2020-0091", "manufacturer":"ABB",          "year_installed":2020, "cadence_ref":0,  "notes":"Calibration OK Jan 2025.",          "tags":["robot","MIG"]},
              {"name":"200T Hydraulic Press",     "machine_type":"Hydraulic Press", "machine_function":"Assembly",          "status":"maint",   "serial_number":"PRH-2015-0012", "manufacturer":"Schuler",      "year_installed":2015, "cadence_ref":40, "notes":"Hydraulic oil maintenance.",        "tags":["critical"]},
            ],
          },
        ],
      },
      {
        "name": "Building B — Logistics",
        "workshops": [
          {
            "name": "Receiving Area",
            "machines": [
              {"name":"Knapp Conveyor",           "machine_type":"Conveyor",        "machine_function":"Material Handling", "status":"running", "serial_number":"CON-2018-0003", "manufacturer":"Knapp",        "year_installed":2018, "cadence_ref":0,  "notes":"Belt sector 3 replaced 01/15.",     "tags":["continuous"]},
            ],
          },
        ],
      },
    ],
  },
  {
    "name": "Grenoble Plant — Alpexpo",
    "address": "Grenoble, France", "country": "France", "timezone": "Europe/Paris",
    "buildings": [
      {
        "name": "Main Hall",
        "workshops": [
          {
            "name": "Electronics Workshop",
            "machines": [
              {"name":"Juki SMT Line",            "machine_type":"Assembly Line",   "machine_function":"Assembly",          "status":"running", "serial_number":"SMT-2022-0301", "manufacturer":"Juki",         "year_installed":2022, "cadence_ref":120,"notes":"PCB series C. Scrap < 0.3%.",       "tags":["SMT","PCB"]},
              {"name":"Cognex AOI IS7402",        "machine_type":"Vision Inspection","machine_function":"Quality Control",  "status":"running", "serial_number":"COG-2022-0045", "manufacturer":"Cognex",       "year_installed":2022, "cadence_ref":0,  "notes":"Linked to SMT line.",               "tags":["vision"]},
              {"name":"Heller Reflow Oven",       "machine_type":"Industrial Oven", "machine_function":"Heat Treatment",    "status":"idle",    "serial_number":"HEL-2021-0119", "manufacturer":"Heller",       "year_installed":2021, "cadence_ref":0,  "notes":"Idle between batches.",             "tags":["reflow"]},
            ],
          },
          {
            "name": "Plastic Injection",
            "machines": [
              {"name":"Arburg 720S",              "machine_type":"Injection Molder","machine_function":"Assembly",          "status":"running", "serial_number":"ARB-2019-0207", "manufacturer":"Arburg",       "year_installed":2019, "cadence_ref":60, "notes":"Mold #12. Cycle 28s. PA66.",        "tags":["injection"]},
              {"name":"KraussMaffei 150T",        "machine_type":"Injection Molder","machine_function":"Assembly",          "status":"down",    "serial_number":"KM-2017-0088",  "manufacturer":"KraussMaffei", "year_installed":2017, "cadence_ref":45, "notes":"DOWN — Ejector cylinder failed.",    "tags":["urgent"]},
            ],
          },
        ],
      },
    ],
  },
  {
    "name": "Bordeaux Plant — Mérignac",
    "address": "Bordeaux, France", "country": "France", "timezone": "Europe/Paris",
    "buildings": [
      {
        "name": "Main Factory",
        "workshops": [
          {
            "name": "Cutting Workshop",
            "machines": [
              {"name":"Trumpf 5000 CO2 Laser",    "machine_type":"Laser Cutter",    "machine_function":"Machining",         "status":"running", "serial_number":"TRU-2023-0551", "manufacturer":"Trumpf",       "year_installed":2023, "cadence_ref":0,  "notes":"New machine. OEE > 85%.",           "tags":["laser","new"]},
            ],
          },
        ],
      },
    ],
  },
]


async def seed():
    async with AsyncSessionLocal() as db:
        # Vérifier si déjà seedé
        count = await db.execute(select(Site))
        if count.scalars().first():
            print("  ⏭  Sites déjà présents — seed ignoré")
            return

        total_machines = 0
        for s_data in DEMO:
            buildings_data = s_data.pop("buildings")
            site = Site(**s_data)
            db.add(site)
            await db.flush()
            print(f"  ✓ Site: {site.name}")

            for b_data in buildings_data:
                workshops_data = b_data.pop("workshops")
                building = Building(site_id=site.id, **b_data)
                db.add(building)
                await db.flush()

                for w_data in workshops_data:
                    machines_data = w_data.pop("machines")
                    workshop = Workshop(building_id=building.id, **w_data)
                    db.add(workshop)
                    await db.flush()

                    for m_data in machines_data:
                        m_data["status"] = MachineStatus(m_data["status"])
                        machine = Machine(workshop_id=workshop.id, **m_data)
                        db.add(machine)
                        total_machines += 1

        await db.commit()
        print(f"\n  → {total_machines} machines créées sur 3 sites")
        print("Seed référentiel terminé.")


if __name__ == "__main__":
    asyncio.run(seed())
