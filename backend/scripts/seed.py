#!/usr/bin/env python3
"""
Seed initial — à lancer depuis le dossier backend/ :

    python scripts/seed.py
"""
import asyncio
import sys
import os

# Permet d'importer app/ sans installation du package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole

SEED_USERS = [
    {"email": "admin@oee.local",        "full_name": "Administrateur OEE", "password": "Admin1234!",  "role": UserRole.admin},
    {"email": "superviseur@oee.local",  "full_name": "Marie Dupont",        "password": "Super1234!",  "role": UserRole.supervisor},
    {"email": "operateur@oee.local",    "full_name": "Jean Martin",         "password": "Oper1234!",   "role": UserRole.operator},
    {"email": "maintenance@oee.local",  "full_name": "Pierre Bernard",      "password": "Maint1234!",  "role": UserRole.maintenance},
]


async def seed():
    async with AsyncSessionLocal() as db:
        for u in SEED_USERS:
            existing = await db.execute(select(User).where(User.email == u["email"]))
            if existing.scalar_one_or_none():
                print(f"  ⏭  {u['email']} existe déjà")
                continue
            db.add(User(
                email=u["email"],
                full_name=u["full_name"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
            ))
            print(f"  ✓  {u['email']} [{u['role'].value}]")
        await db.commit()
    print("\nSeed terminé.")


if __name__ == "__main__":
    asyncio.run(seed())
