# OEE Pro — Manufacturing Intelligence Platform

Application de pilotage de performance machine (OEE/TRS) pour l'industrie 4.0.
Monorepo fullstack : React + TypeScript / FastAPI / PostgreSQL / Docker.

---

## Stack technique

| Couche     | Technologie                          | Version  |
|------------|--------------------------------------|----------|
| Frontend   | React + TypeScript + Vite            | React 18 |
| Backend    | FastAPI + SQLAlchemy async           | Python 3.13 |
| Base de données | PostgreSQL                      | 16       |
| Auth       | JWT Bearer (python-jose)            | —        |
| ORM        | SQLAlchemy 2.x async + asyncpg      | —        |
| Migrations | Alembic                              | —        |
| HTTP client| httpx (scripts) + axios (frontend)  | —        |

---

## Structure du projet

```
oee-pro/
├── start_backend.sh          # Lance PostgreSQL + backend
├── start_frontend.sh         # Lance le frontend
├── start_simulator.sh        # Lance le simulateur avec vérifications
├── docker-compose.yml        # PostgreSQL uniquement (profil "full" pour tout Docker)
├── .env.example
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py         # Settings Pydantic (lecture .env)
│   │   │   ├── security.py       # Hash bcrypt, création/vérification JWT
│   │   │   └── dependencies.py   # CurrentUser, MaintenanceOrAbove (FastAPI Depends)
│   │   ├── db/
│   │   │   └── session.py        # Engine async, AsyncSessionLocal, Base
│   │   ├── models/
│   │   │   ├── __init__.py       # Re-export de tous les modèles (requis par Alembic)
│   │   │   ├── user.py           # User, UserRole enum
│   │   │   ├── referentiel.py    # Site, Building, Machine, MachineStatus enum
│   │   │   └── events.py         # MachineEvent, EventType, MaintType enums
│   │   ├── schemas/
│   │   │   ├── user.py           # UserCreate, UserOut, LoginRequest, TokenOut
│   │   │   ├── referentiel.py    # SiteOut, BuildingOut, MachineOut, MachineUpdate
│   │   │   └── events.py         # MachineEventCreate/Out, TimelineResponse
│   │   ├── services/
│   │   │   ├── auth_service.py       # authenticate_user, register_user
│   │   │   ├── referentiel_service.py# CRUD sites/buildings/machines
│   │   │   └── events_service.py     # CRUD events + get_timeline
│   │   ├── routers/
│   │   │   ├── auth.py           # POST /login, /register, GET /me
│   │   │   ├── health.py         # GET /health, /health/db
│   │   │   ├── referentiel.py    # CRUD sites/buildings/machines
│   │   │   │                     # + GET /sites/tree, GET /machines
│   │   │   └── events.py         # GET+POST /machines/{id}/events
│   │   │                         # GET /machines/{id}/timeline
│   │   └── main.py               # App FastAPI, CORS, inclusion des routers
│   ├── alembic/
│   │   ├── env.py                # Config async Alembic
│   │   └── versions/
│   │       ├── 0001_init_users.py     # Table users + enum user_role
│   │       ├── 0002_referentiel.py    # Tables sites/buildings/machines
│   │       └── 0003_events.py         # Table machine_events
│   ├── scripts/
│   │   ├── seed.py               # Utilisateurs de démo
│   │   ├── seed_referentiel.py   # Sites, bâtiments, machines
│   │   └── seed_events.py        # Événements de démo
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts         # Axios instance, intercepteur JWT
│   │   │   ├── auth.ts           # login(), getMe()
│   │   │   ├── referentiel.ts    # getSitesTree(), getAllMachines(), updateMachine()
│   │   │   └── events.ts         # getTimeline(), createEvent()
│   │   ├── hooks/
│   │   │   └── useReferentiel.ts # useSitesTree, useAllMachines, useUpdateMachine,
│   │   │                         # useTimeline, useCreateEvent
│   │   ├── lib/
│   │   │   └── oee.ts            # calcWeeklyOEE(), STATUS_CONFIG, EVENT_CONFIG,
│   │   │                         # oeeColor(), pct(), fmtDur()
│   │   ├── store/
│   │   │   └── authStore.ts      # Zustand : user, token, login(), logout()
│   │   ├── components/
│   │   │   ├── PrivateRoute.tsx  # Garde de route JWT
│   │   │   ├── Timeline.tsx      # SVG timeline barres colorées
│   │   │   ├── Donut.tsx         # SVG donut OEE (slices A/P/Q)
│   │   │   ├── BarChartOEE.tsx   # SVG bar chart historique hebdomadaire
│   │   │   ├── DateRangePicker.tsx # Sélecteur de période
│   │   │   └── MaintPanel.tsx    # Panel maintenance
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx     # Page de connexion
│   │   │   ├── AssetsPage.tsx    # Page actifs (arbre machines)
│   │   │   └── DashboardPage.tsx # Dashboard OEE
│   │   └── App.tsx               # Router React, QueryClientProvider
│   ├── vite.config.ts            # Proxy /api → localhost:8000
│   └── package.json
│
└── simulator/
    ├── machine_simulator.py      # Génère événements réalistes → JSON
    ├── api_connector.py          # JSON → POST /machines/{id}/events
    ├── simulator_README.md       # Documentation simulateur
    └── data/                     # Fichiers JSON générés
```

---

## Installation from scratch

### Prérequis

- Python 3.13+
- Node.js 18+
- Docker Desktop

### 1. Cloner et configurer l'environnement

```bash
git clone <repo> oee-pro && cd oee-pro

# Variables d'environnement
cp .env.example backend/.env
# Éditer backend/.env si nécessaire (DB_URL, SECRET_KEY, etc.)
```

### 2. Démarrer PostgreSQL

```bash
# Option 1 : PostgreSQL uniquement (recommandé pour développement)
docker compose up -d db

# Option 2 : Tout en Docker (backend + frontend + DB)
docker compose --profile full up -d

# Vérifier : docker compose ps
```

### 3. Backend

```bash
cd backend

# Environnement virtuel
python3 -m venv .venv
source .venv/bin/activate

# Dépendances — attention aux versions critiques Python 3.13
pip install -r requirements.txt

# Migrations
alembic upgrade head

# Seeds de démo
python scripts/seed.py              # utilisateurs
python scripts/seed_referentiel.py  # sites, bâtiments, machines
python scripts/seed_events.py       # événements de démo

# Démarrer
uvicorn app.main:app --reload --port 8000

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Comptes de démo

| Rôle         | Email                    | Mot de passe  |
|--------------|--------------------------|---------------|
| Admin        | admin@oee.local          | Admin1234!    |
| Superviseur  | superviseur@oee.local    | Super1234!    |
| Opérateur    | operateur@oee.local      | Oper1234!     |
| Maintenance  | maintenance@oee.local    | Maint1234!    |

---

## Endpoints API

Base URL : `http://localhost:8000/api/v1`
Documentation Swagger : `http://localhost:8000/docs`

### Auth
| Méthode | Route               | Description              |
|---------|---------------------|--------------------------|
| POST    | /auth/login         | Obtenir un token JWT     |
| POST    | /auth/register      | Créer un utilisateur     |
| GET     | /auth/me            | Utilisateur connecté     |

### Référentiel
| Méthode | Route                  | Description                    |
|---------|------------------------|--------------------------------|
| GET     | /sites/tree            | Arbre complet Site→Machine     |
| GET     | /machines              | Toutes les machines à plat     |
| PUT     | /machines/{id}         | Modifier statut, tags, notes   |

### Événements
| Méthode | Route                                | Description                    |
|---------|--------------------------------------|--------------------------------|
| GET     | /machines/{id}/timeline              | Timeline événements (14j)      |
| GET     | /machines/{id}/events                | Historique événements          |
| POST    | /machines/{id}/events                | Déclarer un événement          |
| PUT     | /events/{id}                         | Modifier un événement          |

---

## Problèmes connus Python 3.13 / asyncpg

Ces incompatibilités ont été rencontrées et résolues — **ne pas modifier ces versions**.

| Problème | Cause | Solution appliquée |
|---|---|---|
| `asyncpg` ne compile pas | Python 3.13 incompatible avec 0.29 | `asyncpg>=0.30.0` dans requirements.txt |
| `passlib` crash sur bcrypt | bcrypt 5.x incompatible passlib 1.7.4 | `bcrypt==4.2.1` direct, security.py réécrit sans passlib |
| `pydantic EmailStr` rejette `.local` | email-validator trop strict | `str` + validator custom dans les schemas |
| Alembic `DuplicateObjectError` sur enums | SQLAlchemy recrée le type si déjà existant | `checkfirst=True` sur `sa.Enum()` dans les migrations 0001/0002 |
| Alembic `cannot insert multiple commands` | asyncpg limite à 1 statement par `op.execute()` | **Migration 0003 en SQL pur, 1 `op.execute()` par commande** |

### Règle critique pour les migrations Alembic + asyncpg

```python
# ✗ INTERDIT — asyncpg refuse plusieurs commandes dans un seul op.execute()
op.execute("CREATE TABLE a (...); CREATE TABLE b (...);")

# ✓ CORRECT — un op.execute() par commande SQL
op.execute("CREATE TABLE a (...)")
op.execute("CREATE TABLE b (...)")

# ✓ CORRECT — les blocs DO $$ ... $$ comptent comme une seule commande
op.execute("DO $$ BEGIN CREATE TYPE x AS ENUM (...); EXCEPTION WHEN duplicate_object THEN null; END $$")

# ✗ INTERDIT — SQLAlchemy tente de recréer l'enum via create_table
op.create_table("t", sa.Column("c", sa.Enum("a","b", name="my_enum")))

# ✓ CORRECT — déclarer la colonne en Text(), puis ALTER après
op.create_table("t", sa.Column("c", sa.Text()))
op.execute("ALTER TABLE t ALTER COLUMN c TYPE my_enum USING c::my_enum")
```

---

## Calcul OEE

```
OEE = Disponibilité (A) × Performance (P) × Qualité (Q)

A = (temps_total - pannes - maintenances) / temps_total
P = 0.70 + (ratio_production / disponibilite - 0.70) × 0.5   [approximation Phase 2]
Q = bonnes_minutes / total_minutes_production

Seuils :
  OEE ≥ 85% → excellent (vert)
  OEE ≥ 65% → acceptable (orange)
  OEE  < 65% → insuffisant (rouge)
```

Le calcul OEE est actuellement fait côté frontend (`lib/oee.ts`).
Le routeur OEE backend (`routers/oee.py`) est implémenté mais commenté dans `main.py` (phase 4).

---

## Simulateur de données

Le simulateur génère des données réalistes pour tester l'application OEE.

```bash
# Depuis oee-pro/

# Méthode simple (recommandée) - lance tout automatiquement
./start_simulator.sh

# Générer 30 jours de données
./start_simulator.sh --days 30

# Sauter les vérifications préalables (si vous savez que tout est OK)
./start_simulator.sh --skip-checks

# Méthode manuelle détaillée
# 1. Générer les données (14 jours par défaut)
python simulator/machine_simulator.py

# 2. Générer pour une machine spécifique
python simulator/machine_simulator.py --machine-id <uuid>

# 3. Générer 30 jours
python simulator/machine_simulator.py --days 30

# 4. Vérifier sans envoyer (dry-run)
python simulator/api_connector.py \
  --file ./simulator/data/simulation_$(date +%Y-%m-%d)_14j.json \
  --dry-run

# 5. Pousser vers l'API
python simulator/api_connector.py \
  --file ./simulator/data/simulation_$(date +%Y-%m-%d)_14j.json
```

Voir `simulator/simulator_README.md` pour plus de détails sur les profils machine et le format JSON.

## Ingestion de données

Les fichiers de simulation sont générés dans `simulator/data/` par `simulator/machine_simulator.py`.
L'usage actuel est :
- générer un fichier JSON de simulation
- envoyer ce fichier vers l'API avec `simulator/api_connector.py`

Pour automatiser le calcul des données sans injection manuelle directe en base, l'application peut évoluer vers :
- un endpoint d'ingestion backend (`POST /api/v1/import/events`)
- un dossier d'arrivée dédié comme `data/incoming/`
- un service d'archivage des fichiers traités dans `data/archive/`
- une validation stricte du format JSON/CSV avant insertion

Cela permettra de créer un vrai flux "fichier → ingestion → calcul OEE".

---

## Phases de développement

| Phase | Statut | Contenu |
|-------|--------|---------|
| 1 | ✅ Terminé | Socle FastAPI + JWT + PostgreSQL |
| 2 | ✅ Terminé | Référentiel industriel (sites/bâtiments/machines) |
| 3 | ✅ Terminé | Événements machine + timeline frontend |
| 4 | 🔲 Prévu | Calcul OEE backend, endpoint `/machines/{id}/oee`, historique |
| 5 | 🔲 Prévu | Audit trail, monitoring, sécurité prod |
| 6 | 🔲 Prévu | Bridge MQTT → REST, intégrations OT/SI |

---

## Données de démo

**3 sites** : Lyon Plant — Confluence / Grenoble Plant — Alpexpo / Bordeaux Plant — Mérignac

**12 machines** réparties sur 6 ateliers :

| Machine | Type | Site | Statut |
|---------|------|------|--------|
| CNC Lathe Fanuc 300i | CNC Lathe | Lyon | running |
| 5-Axis DMG UGV Center | Machining Center | Lyon | idle |
| Maho 700 Mill | Milling Machine | Lyon | running |
| ABB IRB 2600 Robot | Welding Robot | Lyon | running |
| 200T Hydraulic Press | Hydraulic Press | Lyon | maint |
| Knapp Conveyor | Conveyor | Lyon | running |
| Juki SMT Line | Assembly Line | Grenoble | running |
| Cognex AOI IS7402 | Vision Inspection | Grenoble | running |
| Heller Reflow Oven | Industrial Oven | Grenoble | idle |
| Arburg 720S | Injection Molder | Grenoble | running |
| KraussMaffei 150T | Injection Molder | Grenoble | down |
| Trumpf 5000 CO₂ Laser | Laser Cutter | Bordeaux | running |

---

## Scripts utiles

```bash
# Remettre à zéro la base (DESTRUCTIF)
docker compose down -v && docker compose up -d postgres

# Re-appliquer toutes les migrations et seeds
cd backend
alembic upgrade head
python scripts/seed.py
python scripts/seed_referentiel.py
python scripts/seed_events.py

# Vérifier l'état des migrations
alembic current
alembic history

# Tester l'API sans frontend
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@oee.local","password":"Admin1234!"}' \
  | python3 -m json.tool
```
