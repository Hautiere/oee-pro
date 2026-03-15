#!/bin/bash
# ─────────────────────────────────────────────
# start_backend.sh — Lance le backend OEE Pro
# Usage : ./start_backend.sh
# ─────────────────────────────────────────────

set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV="$BACKEND_DIR/.venv"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       OEE Pro — Backend              ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. PostgreSQL via Docker
echo "▶ Démarrage PostgreSQL..."
cd "$ROOT_DIR"
docker compose up db -d 2>&1 | grep -v "^WARN"
echo "  ✓ PostgreSQL démarré"
echo ""

# 2. Attendre que PostgreSQL soit prêt
echo "▶ Attente connexion PostgreSQL..."
for i in {1..15}; do
  if docker exec oee_pro_db pg_isready -U oee_user -d oee_pro_db -q 2>/dev/null; then
    echo "  ✓ PostgreSQL prêt"
    break
  fi
  if [ $i -eq 15 ]; then
    echo "  ✗ PostgreSQL n'a pas démarré — vérifier : docker compose ps"
    exit 1
  fi
  sleep 1
done
echo ""

# 3. Venv Python
echo "▶ Environnement Python..."
cd "$BACKEND_DIR"
if [ ! -d "$VENV" ]; then
  echo "  Création du venv..."
  python3 -m venv .venv
fi
source "$VENV/bin/activate"
echo "  ✓ Venv activé ($(python --version))"
echo ""

# 4. Dépendances
echo "▶ Dépendances pip..."
pip install -r requirements.txt -q --disable-pip-version-check
echo "  ✓ Dépendances OK"
echo ""

# 5. Migrations
echo "▶ Migrations Alembic..."
alembic upgrade head 2>&1 | grep -v "^$"
echo "  ✓ Migrations OK"
echo ""

# 6. Seed si table vide
USER_COUNT=$(python3 -c "
import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal
async def count():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text('SELECT COUNT(*) FROM users'))
        return r.scalar()
print(asyncio.run(count()))
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  echo "▶ Seed utilisateurs de démo..."
  python scripts/seed.py 2>&1 | grep -E "✓|✗|terminé"
  echo ""
else
  echo "▶ $USER_COUNT utilisateur(s) en base — seed ignoré"
  echo ""
fi

# 7. Ouvrir Swagger dans le navigateur
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backend   → http://localhost:8000"
echo "  Swagger   → http://localhost:8000/docs"
echo "  Health    → http://localhost:8000/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ouvrir le navigateur après 2s (Mac)
(sleep 2 && open "http://localhost:8000/docs") &

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
