# Simulateur OEE Pro

## Utilisation

```bash
# Depuis oee-pro/

# 1. Générer les données (14 jours par défaut)
python simulator/machine_simulator.py

# 2. Vérifier sans envoyer
python simulator/api_connector.py \
  --file ./simulator/data/simulation_$(date +%Y-%m-%d)_14j.json \
  --dry-run

# 3. Pousser vers l'API
python simulator/api_connector.py \
  --file ./simulator/data/simulation_$(date +%Y-%m-%d)_14j.json

# Options
python simulator/machine_simulator.py --days 30
python simulator/machine_simulator.py --machine-id <uuid>
python simulator/api_connector.py --batch-size 100
```

## Profils machine

| Profil    | OEE cible | Run  | Qualité |
|-----------|-----------|------|---------|
| high      | > 85%     | 78%  | ~95%    |
| medium    | 65-85%    | 65%  | ~88%    |
| degraded  | < 65%     | 45%  | ~78%    |

## Format JSON (compatible MQTT futur)

```json
{
  "simulation_id": "uuid",
  "generated_at":  "ISO8601",
  "machines": [{
    "machine_id":   "uuid",
    "machine_name": "CNC Lathe Fanuc 300i",
    "profile":      "medium",
    "events": [{
      "event_type":  "running|idle|down|maint",
      "started_at":  "ISO8601",
      "ended_at":    "ISO8601",
      "quality_pct": 94,
      "note":        "optionnel"
    }]
  }]
}
```

## Migration vers MQTT (futur)

Remplacer `api_connector.py` par un bridge MQTT→REST :
```
MQTT topic: machines/{machine_id}/events
Payload: même format que ci-dessus (1 événement par message)
```
Le backend FastAPI et le format JSON ne changent pas.
