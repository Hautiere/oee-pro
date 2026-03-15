#!/usr/bin/env python3
"""
api_connector.py — Connecteur JSON → API OEE Pro

Lit un fichier de simulation produit par machine_simulator.py
et pousse les événements vers l'API REST via POST /machines/{id}/events.

Ce script est le point de substitution futur :
  Aujourd'hui : JSON file → REST API
  Demain      : MQTT broker → REST API  (même logique, autre source)

Usage:
    python simulator/api_connector.py --file ./simulator/data/simulation_2025-03-15_14j.json
    python simulator/api_connector.py --file ./simulator/data/simulation_2025-03-15_14j.json --dry-run
    python simulator/api_connector.py --file ./simulator/data/simulation_2025-03-15_14j.json --machine-id <uuid>
    python simulator/api_connector.py --file ./simulator/data/simulation_2025-03-15_14j.json --batch-size 50
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx


# ─── Config ───────────────────────────────────────────────────────────────────

DEFAULT_BASE_URL  = os.getenv("OEE_API_URL",      "http://localhost:8000/api/v1")
DEFAULT_EMAIL     = os.getenv("OEE_API_EMAIL",     "admin@oee.local")
DEFAULT_PASSWORD  = os.getenv("OEE_API_PASSWORD",  "Admin1234!")
DEFAULT_BATCH     = 50      # événements poussés par lot
DEFAULT_DELAY     = 0.05    # secondes entre lots (throttling léger)


# ─── Auth ─────────────────────────────────────────────────────────────────────

async def get_token(client: httpx.AsyncClient, base_url: str, email: str, password: str) -> str:
    resp = await client.post(
        f"{base_url}/auth/login",
        json={"email": email, "password": password},
        timeout=10,
    )
    resp.raise_for_status()
    token = resp.json().get("access_token")
    if not token:
        raise ValueError("Token absent de la réponse login")
    return token


# ─── Push événements ──────────────────────────────────────────────────────────

async def push_events(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    machine_id: str,
    machine_name: str,
    events: list[dict],
    batch_size: int = DEFAULT_BATCH,
    dry_run: bool = False,
) -> dict:
    """
    Pousse les événements d'une machine vers l'API.
    Retourne un résumé : ok, skipped, errors.
    """
    headers = {"Authorization": f"Bearer {token}"}
    ok = skipped = errors = 0
    error_details = []

    # Trier par date croissante
    events_sorted = sorted(events, key=lambda e: e["started_at"])

    # Découper en lots
    batches = [events_sorted[i:i+batch_size] for i in range(0, len(events_sorted), batch_size)]

    for batch_idx, batch in enumerate(batches):
        for event in batch:
            if dry_run:
                ok += 1
                continue

            payload = {
                "event_type":  event["event_type"],
                "started_at":  event["started_at"],
                "ended_at":    event.get("ended_at"),
                "quality_pct": event.get("quality_pct", 100),
                "note":        event.get("note"),
            }
            # Retirer les clés None
            payload = {k: v for k, v in payload.items() if v is not None}

            try:
                resp = await client.post(
                    f"{base_url}/machines/{machine_id}/events",
                    json=payload,
                    headers=headers,
                    timeout=10,
                )
                if resp.status_code == 201:
                    ok += 1
                elif resp.status_code == 409:
                    skipped += 1  # doublon
                else:
                    errors += 1
                    error_details.append({
                        "event_type": event["event_type"],
                        "started_at": event["started_at"],
                        "status":     resp.status_code,
                        "detail":     resp.text[:120],
                    })
            except httpx.TimeoutException:
                errors += 1
                error_details.append({"error": "timeout", "started_at": event["started_at"]})
            except Exception as e:
                errors += 1
                error_details.append({"error": str(e), "started_at": event["started_at"]})

        # Throttle léger entre les lots
        if not dry_run and batch_idx < len(batches) - 1:
            await asyncio.sleep(DEFAULT_DELAY)

    return {"ok": ok, "skipped": skipped, "errors": errors, "error_details": error_details}


# ─── Main ─────────────────────────────────────────────────────────────────────

async def run(
    file_path: str,
    base_url: str,
    email: str,
    password: str,
    batch_size: int,
    machine_filter: Optional[str],
    dry_run: bool,
):
    print(f"\n{'='*60}")
    print(f"  OEE Pro — Connecteur API")
    print(f"  Source : {file_path}")
    print(f"  Cible  : {base_url}")
    if dry_run:
        print(f"  Mode   : DRY-RUN (aucun POST envoyé)")
    print(f"{'='*60}\n")

    # Lire le fichier de simulation
    path = Path(file_path)
    if not path.exists():
        print(f"  ✗ Fichier introuvable : {file_path}")
        sys.exit(1)

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    machines = data.get("machines", [])
    if machine_filter:
        machines = [m for m in machines if m["machine_id"] == machine_filter]
        if not machines:
            print(f"  ✗ Machine {machine_filter} non trouvée dans le fichier")
            sys.exit(1)

    total_events = sum(len(m["events"]) for m in machines)
    print(f"  ▶ {len(machines)} machine(s) · {total_events} événements")
    print(f"  ▶ Période : {data.get('period_start', '?')[:10]} → {data.get('period_end', '?')[:10]}\n")

    if not dry_run:
        # Authentification
        print("  ▶ Authentification...")
        async with httpx.AsyncClient() as client:
            try:
                token = await get_token(client, base_url, email, password)
                print(f"  ✓ Token obtenu\n")
            except Exception as e:
                print(f"  ✗ Échec authentification : {e}")
                sys.exit(1)

            # Push par machine
            grand_ok = grand_skip = grand_err = 0
            t0 = time.time()

            for m in machines:
                mid   = m["machine_id"]
                mname = m["machine_name"]
                nevts = len(m["events"])
                print(f"  ⚙  {mname}")
                print(f"     {nevts} événements · profil: {m.get('profile','?')}")

                result = await push_events(
                    client, base_url, token,
                    machine_id=mid,
                    machine_name=mname,
                    events=m["events"],
                    batch_size=batch_size,
                    dry_run=False,
                )
                grand_ok   += result["ok"]
                grand_skip += result["skipped"]
                grand_err  += result["errors"]

                status = "✓" if result["errors"] == 0 else "⚠"
                print(f"     {status} ok:{result['ok']} skip:{result['skipped']} err:{result['errors']}")

                if result["error_details"]:
                    for ed in result["error_details"][:3]:
                        print(f"       ! {ed}")

            elapsed = time.time() - t0
            print(f"\n{'='*60}")
            print(f"  Résumé")
            print(f"{'='*60}")
            print(f"  ✓ Poussés   : {grand_ok}")
            print(f"  ⏭ Doublons  : {grand_skip}")
            print(f"  ✗ Erreurs   : {grand_err}")
            print(f"  ⏱ Durée     : {elapsed:.1f}s")
            print(f"  ⚡ Débit     : {grand_ok/elapsed:.0f} events/s\n")

    else:
        # Dry-run : juste afficher le résumé
        for m in machines:
            print(f"  [DRY] {m['machine_name']} → {len(m['events'])} événements seraient poussés")
        print(f"\n  [DRY] Total : {total_events} événements")
        print(f"  Relancez sans --dry-run pour pousser vers l'API\n")


def main():
    parser = argparse.ArgumentParser(
        description="api_connector.py — pousse un fichier de simulation vers l'API OEE Pro"
    )
    parser.add_argument("--file",       required=True,               help="Fichier JSON généré par machine_simulator.py")
    parser.add_argument("--base-url",   default=DEFAULT_BASE_URL,    help=f"URL de l'API (défaut: {DEFAULT_BASE_URL})")
    parser.add_argument("--email",      default=DEFAULT_EMAIL,       help="Email de connexion")
    parser.add_argument("--password",   default=DEFAULT_PASSWORD,    help="Mot de passe")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH, help=f"Taille des lots (défaut: {DEFAULT_BATCH})")
    parser.add_argument("--machine-id", default=None,                help="Pousser une seule machine (UUID)")
    parser.add_argument("--dry-run",    action="store_true",         help="Simuler sans envoyer de requêtes")
    args = parser.parse_args()

    asyncio.run(run(
        file_path=args.file,
        base_url=args.base_url,
        email=args.email,
        password=args.password,
        batch_size=args.batch_size,
        machine_filter=args.machine_id,
        dry_run=args.dry_run,
    ))


if __name__ == "__main__":
    main()
