#!/bin/bash

# OEE Pro Simulator Launcher
# Script pour démarrer facilement le simulateur avec gestion d'erreurs

set -e  # Arrêter le script en cas d'erreur

# ── Configuration ──────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIMULATOR_DIR="$PROJECT_ROOT/simulator"
DATA_DIR="$SIMULATOR_DIR/data"
TODAY=$(date +%Y-%m-%d)
DEFAULT_DAYS=14

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Fonctions utilitaires ──────────────────────────────────────────────────────

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Commande '$1' non trouvée. Veuillez l'installer."
        exit 1
    fi
}

check_python_env() {
    if [[ ! -d "$PROJECT_ROOT/backend/.venv" ]]; then
        log_error "Environnement virtuel Python non trouvé dans backend/.venv"
        log_error "Lancez d'abord : cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
        exit 1
    fi
}

check_database() {
    log_info "Vérification de la base de données PostgreSQL..."

    # Vérifier si PostgreSQL est accessible via Docker
    if docker compose ps db 2>/dev/null | grep -q "Up"; then
        log_success "PostgreSQL (Docker) est en cours d'exécution"
        return 0
    fi

    # Essayer de le démarrer automatiquement
    log_warning "PostgreSQL n'est pas lancé — tentative de démarrage automatique..."
    cd "$PROJECT_ROOT"
    if docker compose up db -d >/dev/null 2>&1; then
        # Attendre qu'il soit prêt
        for i in {1..15}; do
            if docker exec oee_pro_db pg_isready -U oee_user -d oee_pro_db -q 2>/dev/null; then
                log_success "PostgreSQL démarré et prêt"
                return 0
            fi
            sleep 1
        done
    fi

    log_error "Impossible de démarrer PostgreSQL automatiquement"
    log_error "Lancez manuellement : docker compose up db -d"
    exit 1
}

check_api() {
    log_info "Vérification de l'API backend..."

    if curl -s -f http://localhost:8000/health >/dev/null 2>&1; then
        log_success "API backend accessible sur http://localhost:8000"
        return 0
    else
        # Essayer de démarrer le backend automatiquement
        log_warning "API backend non accessible — tentative de démarrage automatique..."
        if [[ -x "$PROJECT_ROOT/start_backend.sh" ]]; then
            log_info "Lancement du backend..."
            # Lancer en arrière-plan et attendre qu'il soit prêt
            "$PROJECT_ROOT/start_backend.sh" >/dev/null 2>&1 &
            BACKEND_PID=$!

            # Attendre que l'API soit prête (max 30 secondes)
            for i in {1..30}; do
                if curl -s -f http://localhost:8000/health >/dev/null 2>&1; then
                    log_success "Backend démarré et API accessible"
                    return 0
                fi
                sleep 1
            done

            # Si on arrive ici, le backend n'a pas réussi à démarrer
            kill $BACKEND_PID 2>/dev/null || true
            log_error "Échec du démarrage automatique du backend"
        else
            log_error "Script start_backend.sh non trouvé ou non exécutable"
        fi

        log_error "Lancez manuellement : ./start_backend.sh"
        exit 1
    fi
}

check_machines() {
    log_info "Vérification des machines dans la base de données..."

    # Activer l'environnement virtuel et vérifier les machines
    cd "$PROJECT_ROOT/backend"
    source .venv/bin/activate

    # Créer un script temporaire pour éviter les problèmes de parsing bash
    TMP_SCRIPT=$(mktemp)
    cat > "$TMP_SCRIPT" << 'EOF'
import asyncio
import sys
import os
sys.path.insert(0, '.')

# Désactiver les logs SQLAlchemy pour éviter les conflits avec bash
import logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

from app.db.session import AsyncSessionLocal
from app.models.referentiel import Machine
from sqlalchemy import select

async def count_machines():
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Machine).where(Machine.is_active == True))
            machines = result.scalars().all()
            return len(machines)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 0

if __name__ == "__main__":
    count = asyncio.run(count_machines())
    print(count)
EOF

    MACHINE_COUNT=$(python3 "$TMP_SCRIPT" 2>/dev/null | grep -E '^[0-9]+$' | tail -n1)
    rm "$TMP_SCRIPT"

    if [[ "$MACHINE_COUNT" =~ ^[0-9]+$ ]] && [[ "$MACHINE_COUNT" -gt 0 ]]; then
        log_success "$MACHINE_COUNT machine(s) trouvée(s) dans la base"
        return 0
    else
        log_error "Aucune machine trouvée dans la base de données"
        log_error "Lancez d'abord : cd backend && source .venv/bin/activate && python scripts/seed_referentiel.py"
        exit 1
    fi
}

generate_simulation() {
    local days="$1"
    log_info "Génération de $days jours de données simulées..."

    cd "$PROJECT_ROOT"

    if ! python3 simulator/machine_simulator.py --days "$days"; then
        log_error "Échec de la génération des données simulées"
        exit 1
    fi

    # Trouver le fichier généré
    SIMULATION_FILE="$DATA_DIR/simulation_${TODAY}_${days}j.json"
    if [[ ! -f "$SIMULATION_FILE" ]]; then
        log_error "Fichier de simulation non trouvé : $SIMULATION_FILE"
        exit 1
    fi

    log_success "Données générées : $SIMULATION_FILE"
    echo "$SIMULATION_FILE"
}

push_to_api() {
    local simulation_file="$1"
    log_info "Envoi des données vers l'API..."

    cd "$PROJECT_ROOT"

    if ! python3 simulator/api_connector.py --file "$simulation_file"; then
        log_error "Échec de l'envoi des données vers l'API"
        exit 1
    fi

    log_success "Données envoyées avec succès !"
}

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Lance le simulateur OEE Pro avec vérifications préalables"
    echo ""
    echo "Options:"
    echo "  -d, --days NOMBRE    Nombre de jours à simuler (défaut: $DEFAULT_DAYS)"
    echo "  -h, --help           Afficher cette aide"
    echo "  --skip-checks        Sauter les vérifications préalables"
    echo ""
    echo "Exemples:"
    echo "  $0                    # Simulation de 14 jours"
    echo "  $0 --days 30          # Simulation de 30 jours"
    echo "  $0 --skip-checks      # Sauter les vérifications"
}

# ── Script principal ──────────────────────────────────────────────────────────

main() {
    local days="$DEFAULT_DAYS"
    local skip_checks=false

    # Parser les arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--days)
                days="$2"
                shift 2
                ;;
            --skip-checks)
                skip_checks=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Option inconnue: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                 OEE Pro Simulator Launcher                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    # Vérifications préalables
    if [[ "$skip_checks" != true ]]; then
        log_info "Vérifications préalables..."
        check_command "python3"
        check_command "curl"
        check_python_env
        check_database
        check_api
        check_machines
        log_success "Toutes les vérifications passées ✓"
        echo ""
    else
        log_warning "Vérifications préalables ignorées (--skip-checks)"
    fi

    # Génération des données
    generate_simulation "$days"
    echo ""

    # Envoi vers l'API
    push_to_api "$SIMULATION_FILE"
    echo ""

    # Résumé final
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                        Simulation terminée                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    log_success "✅ Simulateur exécuté avec succès !"
    log_info "📊 Données disponibles dans l'application OEE Pro"
    log_info "🌐 Accédez à http://localhost:5173 pour voir les résultats"
    echo ""
}

# Gestion des erreurs
trap 'log_error "Script interrompu par l utilisateur"' INT
trap 'log_error "Erreur inattendue à la ligne $LINENO"' ERR

# Lancer le script
main "$@"