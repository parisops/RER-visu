#!/usr/bin/env python3
"""
build_live_trains.py — Reconstruit la position de chaque train RER C a partir
de data/live-departures.json (sortie de fetch_prim_departures.py) et ecrit
data/live-trains.json, consomme par js/trains.js pour l'animation "suivi des
trains" (position interpolee entre deux gares, faute de position GPS
temps reel cote PRIM pour les RER/Transilien).

Principe :
- PRIM ne donne pas la position GPS d'un train RER, seulement, gare par gare,
  l'heure theorique/estimee de passage. On regroupe donc tous les passages
  par code mission ("ORET", "DEBA", ...) - identifiant unique par train et
  par jour cote SNCF/Transilien, deja capture par fetch_prim_departures.py -
  pour reconstituer la liste ordonnee des gares desservies aujourd'hui par
  CE train, puis on interpole sa position entre la derniere gare deja
  desservie et la prochaine.

USAGE (local, apres avoir lance fetch_prim_departures.py) :
  python3 tools/build_live_trains.py

Entree : data/live-departures.json
Sortie : data/live-trains.json

Limite connue : un train dont on n'a encore vu aucun passage ("notStarted")
ou dont le dernier passage connu est trop ancien sans passage suivant dans la
fenetre PRIM ("expired") n'est pas affiche. Le seuil ARRIVED_GRACE_MINUTES
controle combien de temps un train reste visible "a quai" apres son dernier
passage connu, avant de disparaitre.
"""
import json
import os
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IN_PATH = os.path.join(ROOT, "data", "live-departures.json")
OUT_PATH = os.path.join(ROOT, "data", "live-trains.json")

# Duree pendant laquelle un train reste affiche "a quai" apres son dernier
# arret connu quand aucun arret suivant n'est encore visible dans PRIM.
ARRIVED_GRACE_MINUTES = 3


def parse_iso(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def load_departures():
    with open(IN_PATH, encoding="utf-8") as f:
        return json.load(f)


def build_missions(data):
    """Regroupe tous les passages par code mission -> trajet ordonne."""
    missions = {}
    for station_key, station_data in data.get("stations", {}).items():
        for dep in station_data.get("departures", []):
            code = dep.get("code")
            if not code or code == "----":
                continue  # code mission manquant : train non identifiable, on l'ignore
            stop = {
                "station": station_key,
                "scheduled": dep["scheduled"],
                "expected": dep["expected"],
                "status": dep.get("status", "onTime"),
                "delay": dep.get("delay", 0),
                "platform": dep.get("platform"),
            }
            mission = missions.setdefault(code, {
                "code": code,
                "dest": dep.get("dest", "?"),
                "dir": dep.get("dir", "B"),
                "stops": [],
            })
            mission["stops"].append(stop)
    for mission in missions.values():
        mission["stops"].sort(key=lambda s: s["scheduled"])
    return missions


def locate_train(mission, now):
    """Determine la derniere gare deja desservie (from) et la prochaine (to),
    et la fraction de trajet parcourue entre les deux."""
    stops = mission["stops"]
    past = [s for s in stops if parse_iso(s["expected"]) <= now]
    future = [s for s in stops if parse_iso(s["expected"]) > now]

    from_stop = past[-1] if past else None
    to_stop = future[0] if future else None

    if from_stop and to_stop:
        t_from = parse_iso(from_stop["expected"])
        t_to = parse_iso(to_stop["expected"])
        span = (t_to - t_from).total_seconds()
        progress = (now - t_from).total_seconds() / span if span > 0 else 0.0
        return from_stop, to_stop, max(0.0, min(1.0, progress)), "enRoute"

    if from_stop and not to_stop:
        t_from = parse_iso(from_stop["expected"])
        elapsed_min = (now - t_from).total_seconds() / 60
        if elapsed_min <= ARRIVED_GRACE_MINUTES:
            return from_stop, None, 1.0, "arrived"
        return None, None, None, "expired"

    if to_stop and not from_stop:
        return None, to_stop, None, "notStarted"

    return None, None, None, "unknown"


def build_live_trains():
    data = load_departures()
    now = parse_iso(data["generatedAt"])
    missions = build_missions(data)

    trains = []
    for code, mission in missions.items():
        if not mission["stops"]:
            continue
        from_stop, to_stop, progress, state = locate_train(mission, now)
        if state in ("expired", "notStarted", "unknown"):
            continue  # rien de pertinent a afficher pour ce train dans ce cycle
        cancelled = any(s["status"] == "cancelled" for s in mission["stops"])
        reference_stop = to_stop or from_stop
        trains.append({
            "code": code,
            "dest": mission["dest"],
            "dir": mission["dir"],
            "state": state,              # "enRoute" ou "arrived"
            "cancelled": cancelled,
            "delay": reference_stop["delay"] if reference_stop else 0,
            "from": from_stop,
            "to": to_stop,
            "progress": progress,
            "stops": mission["stops"],   # trajet complet connu (utile pour un panneau detail)
        })

    trains.sort(key=lambda t: t["code"])
    return {"generatedAt": data["generatedAt"], "trains": trains}


def main():
    out = build_live_trains()
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    n_active = sum(1 for t in out["trains"] if t["state"] == "enRoute")
    n_total = len(out["trains"])
    print(f"Ecrit : {OUT_PATH} ({n_total} trains suivis, {n_active} en circulation)")


if __name__ == "__main__":
    main()
