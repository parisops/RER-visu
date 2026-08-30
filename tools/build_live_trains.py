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
  par code mission ("ORET", "DEBA", ...) - deja capture par
  fetch_prim_departures.py - pour reconstituer la liste ordonnee des gares
  desservies aujourd'hui par un train, puis on interpole sa position entre la
  derniere gare deja desservie et la prochaine.

ATTENTION - un code mission n'est PAS un identifiant unique a un instant
donne : PRIM/SNCF reutilise le meme code a 4 lettres pour PLUSIEURS trains
differents circulant simultanement sur des portions distinctes de la ligne
(observe empiriquement : "GOTA" attache a la fois a un passage vers
Epinay-sur-Seine et a un passage vers Champ de Mars a 1 minute d'intervalle,
soit ~650 km/h implicite). Ce script utilise donc les coordonnees GPS des
gares (stations-idfm.js) pour detecter ces incoherences et scinder un code
en plusieurs trains distincts quand la vitesse impliquee entre deux passages
consecutifs depasse un seuil physiquement absurde (MAX_PLAUSIBLE_KMH).

USAGE (local, apres avoir lance fetch_prim_departures.py) :
  python3 tools/build_live_trains.py

Entree : data/live-departures.json, js/stations-idfm.js (pour les coordonnees)
Sortie : data/live-trains.json
"""
import json
import math
import os
import re
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IN_PATH = os.path.join(ROOT, "data", "live-departures.json")
OUT_PATH = os.path.join(ROOT, "data", "live-trains.json")
STATIONS_JS_PATH = os.path.join(ROOT, "js", "stations-idfm.js")

# Duree pendant laquelle un train reste affiche "a quai" apres son dernier
# arret connu quand aucun arret suivant n'est encore visible dans PRIM.
ARRIVED_GRACE_MINUTES = 3

# Vitesse au-dela de laquelle deux passages consecutifs d'un meme code
# mission sont consideres comme appartenant a deux trains differents plutot
# qu'au meme train (RER C ne depasse pas ~160 km/h en pointe ; grande marge
# de securite pour ne jamais couper un vrai trajet rapide).
MAX_PLAUSIBLE_KMH = 180


def parse_iso(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def load_departures():
    with open(IN_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_station_coords():
    """Extrait {seg:idx: (lat, lon)} de js/stations-idfm.js sans dependre d'un parseur JS."""
    with open(STATIONS_JS_PATH, encoding="utf-8") as f:
        js = f.read()
    coords = {}
    pattern = re.compile(
        r'"(\w+:\d+)":\s*\{[^{}]*?lat:\s*([\-0-9.]+)[^{}]*?lon:\s*([\-0-9.]+)',
        re.DOTALL,
    )
    for key, lat, lon in pattern.findall(js):
        coords[key] = (float(lat), float(lon))
    return coords


def haversine_km(a, b):
    lat1, lon1 = a
    lat2, lon2 = b
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    x = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def build_missions(data):
    """Regroupe tous les passages par code mission -> liste de gares triees
    (sans encore separer les collisions de code, voir split_into_trains)."""
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


def split_into_trains(mission, coords):
    """Scinde les arrets d'un code mission en sous-sequences physiquement
    plausibles (vitesse implicite <= MAX_PLAUSIBLE_KMH entre deux arrets
    consecutifs). Retourne une liste de mini-"mission" (memes cles que
    l'entree), chacune representant un train distinct."""
    stops = mission["stops"]
    if len(stops) <= 1:
        return [mission] if stops else []

    runs = [[stops[0]]]
    for prev, cur in zip(stops, stops[1:]):
        c_prev = coords.get(prev["station"])
        c_cur = coords.get(cur["station"])
        same_train = True
        if c_prev and c_cur and c_prev != c_cur:
            dt_h = (parse_iso(cur["expected"]) - parse_iso(prev["expected"])).total_seconds() / 3600
            if dt_h > 0:
                speed = haversine_km(c_prev, c_cur) / dt_h
                if speed > MAX_PLAUSIBLE_KMH:
                    same_train = False
        if same_train:
            runs[-1].append(cur)
        else:
            runs.append([cur])

    result = []
    for run in runs:
        result.append({
            "code": mission["code"],
            "dest": mission["dest"],
            "dir": mission["dir"],
            "stops": run,
        })
    return result


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
    coords = load_station_coords()
    missions = build_missions(data)

    trains = []
    for code, mission in missions.items():
        runs = split_into_trains(mission, coords)
        multi = len(runs) > 1
        for i, run in enumerate(runs, 1):
            if not run["stops"]:
                continue
            from_stop, to_stop, progress, state = locate_train(run, now)
            if state in ("expired", "notStarted", "unknown"):
                continue
            cancelled = any(s["status"] == "cancelled" for s in run["stops"])
            reference_stop = to_stop or from_stop
            display_code = f"{code}\u00b7{i}" if multi else code
            trains.append({
                "code": display_code,
                "dest": run["dest"],
                "dir": run["dir"],
                "state": state,
                "cancelled": cancelled,
                "delay": reference_stop["delay"] if reference_stop else 0,
                "from": from_stop,
                "to": to_stop,
                "progress": progress,
                "stops": run["stops"],
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
