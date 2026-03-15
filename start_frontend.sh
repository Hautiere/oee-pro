#!/bin/bash
# ─────────────────────────────────────────────
# start_frontend.sh — Lance le frontend OEE Pro
# Usage : ./start_frontend.sh
# ─────────────────────────────────────────────

set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       OEE Pro — Frontend             ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. Vérifier Node.js
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js non trouvé — installer depuis https://nodejs.org"
  exit 1
fi
echo "▶ Node.js $(node --version) détecté"
echo ""

# 2. Vérifier que le backend répond
echo "▶ Vérification backend..."
if curl -s http://localhost:8000/health | grep -q '"ok"'; then
  echo "  ✓ Backend opérationnel"
else
  echo "  ⚠ Backend non détecté sur :8000"
  echo "    → Lancer ./start_backend.sh dans un autre terminal"
  read -p "  Continuer quand même ? (o/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    exit 1
  fi
fi
echo ""

# 3. Dépendances npm
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  echo "▶ Installation dépendances npm..."
  npm install
  echo "  ✓ node_modules installés"
else
  echo "▶ node_modules OK"
fi
echo ""

# 4. Ouvrir le navigateur après 3s
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Frontend  → http://localhost:5173"
echo "  Login     → admin@oee.local"
echo "  Password  → Admin1234!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

(sleep 3 && open "http://localhost:5173") &

npm run dev
