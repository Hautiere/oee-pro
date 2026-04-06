# OEE Pro — Tutoriel complet

## Vue d'ensemble

Ce tutoriel vous guide à travers la mise en place complète d'OEE Pro, une plateforme de pilotage de performance machine (OEE/TRS) pour l'industrie 4.0.

L'application démarre vierge et se configure entièrement via des fichiers JSON, permettant une personnalisation complète selon vos besoins.

---

## Prérequis

- **Python 3.13+**
- **Node.js 18+**
- **Docker Desktop**
- **Git**

---

## 1. Installation et démarrage

### Clonage et configuration

```bash
# Cloner le repository
git clone https://github.com/Hautiere/oee-pro.git
cd oee-pro

# Configuration de l'environnement
cp .env.example backend/.env
# Éditer backend/.env si nécessaire (DATABASE_URL, SECRET_KEY)
```

### Démarrage de la base de données

```bash
# PostgreSQL uniquement (recommandé pour le développement)
docker compose up -d db

# Vérifier
docker compose ps
```

### Backend

```bash
cd backend

# Environnement virtuel
python3 -m venv .venv
source .venv/bin/activate

# Dépendances
pip install -r requirements.txt

# Migrations de base de données
alembic upgrade head

# Démarrage
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## 2. Configuration de l'application

### Structure de configuration

L'application démarre vierge. Vous devez charger une configuration d'usine via un fichier JSON.

#### Exemple de fichier de configuration française (`config_fr.json`)

```json
{
  "version": "1.0",
  "language": "fr",
  "company": "Mon Entreprise",
  "sites": [
    {
      "name": "Usine Lyon",
      "location": "Confluence",
      "buildings": [
        {
          "name": "Atelier Production",
          "workshops": [
            {
              "name": "Ligne CNC",
              "machines": [
                {
                  "name": "CNC Fanuc 300i",
                  "type": "CNC Lathe",
                  "status": "running",
                  "description": "Tour CNC haute précision"
                },
                {
                  "name": "5-Axis DMG UGV",
                  "type": "Machining Center",
                  "status": "idle",
                  "description": "Centre d'usinage 5 axes"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

#### Chargement de la configuration

1. **Via l'interface web** :
   - Aller sur http://localhost:5173
   - Se connecter avec un compte admin (admin@oee.local / Admin1234!)
   - Aller dans "Import" → Sélectionner votre fichier `config_fr.json`
   - Cliquer sur "Importer configuration"

2. **Via l'API** :
```bash
curl -X POST "http://localhost:8000/api/v1/config/import" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@config_fr.json"
```

---

## 3. Chargement des données historiques

### Format des données

Les données sont chargées depuis des fichiers JSON générés par le simulateur ou exportés depuis vos systèmes SCADA/PLC.

#### Exemple de fichier de données

```json
{
  "version": "1.0",
  "period_start": "2024-01-01T00:00:00Z",
  "period_end": "2024-01-07T23:59:59Z",
  "machines": [
    {
      "machine_name": "CNC Fanuc 300i",
      "events": [
        {
          "event_type": "running",
          "started_at": "2024-01-01T08:00:00Z",
          "ended_at": "2024-01-01T12:00:00Z",
          "quality_pct": 95
        }
      ]
    }
  ]
}
```

### Chargement des données

1. **Via l'interface web** :
   - Aller dans "Import" → Sélectionner vos fichiers de données
   - Cliquer sur "Importer données"

2. **Via l'API** :
```bash
curl -X POST "http://localhost:8000/api/v1/data/import" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@data_2024-01.json"
```

3. **Chargement automatique** :
   - Placer les fichiers dans le dossier `data/incoming/`
   - L'application les traite automatiquement

---

## 4. Utilisation quotidienne

### Connexion

- URL : http://localhost:5173
- Comptes par défaut :
  - Admin : admin@oee.local / Admin1234!
  - Superviseur : superviseur@oee.local / Super1234!
  - Maintenance : maintenance@oee.local / Maint1234!

### Navigation

1. **Dashboard** : Vue d'ensemble des performances OEE
2. **Actifs** : Arbre des machines avec détails
3. **Import** : Configuration et données

### Calcul OEE

L'OEE est calculé automatiquement selon la formule :
```
OEE = Disponibilité × Performance × Qualité
```

---

## 5. Simulation de données

Pour tester l'application avec des données réalistes :

```bash
# Génération et chargement automatique (recommandé)
./start_simulator.sh

# Génération manuelle de 30 jours
./start_simulator.sh --days 30
```

---

## 6. Personnalisation

### Ajout de nouvelles machines

Modifier votre fichier de configuration JSON et le recharger.

### Nouveaux types d'événements

Étendre le schéma dans `backend/app/schemas/events.py`.

### Intégrations

- **MQTT** : Pour recevoir des données temps réel des machines
- **SCADA** : Export automatique vers vos systèmes existants
- **API REST** : Intégration avec d'autres applications

---

## 7. Fichiers d'exemple

- `config_examples/config_fr.json` : Configuration française
- `config_examples/config_en.json` : Configuration anglaise
- `data_examples/sample_data_2024-01-01_2024-01-07.json` : Données exemple

---

## Support

- Documentation complète : `README.md`
- API documentation : http://localhost:8000/docs