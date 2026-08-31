#!/usr/bin/env python3
"""
build_live_trains.py — Reconstruit la position de chaque train RER C a partir
de data/live-departures.json (sortie de fetch_prim_departures.py) et ecrit
data/live-trains.json, consomme par js/trains.js pour l'animation "suivi des
trains" (position interpolee entre gares, faute de position GPS temps reel
cote PRIM pour les RER/Transilien).

Principe :
- PRIM ne donne pas la position GPS d'un train RER, seulement, gare par gare,
  l'heure theorique/estimee de passage, et seulement sur une fenetre limitee
  (les quelques prochains passages par gare, ~30-60 min d'horizon). On
  regroupe les passages par code mission ("ORET", "DEBA", ...), MAIS :

  1. Un code mission n'est PAS unique a un instant donne : PRIM/SNCF reutilise
     le meme code a 4 lettres pour PLUSIEURS trains differents circulant
     simultanement sur des portions distinctes de la ligne. On scinde donc les
     passages d'un code en sous-sequences physiquement plausibles avant toute
     autre chose (split_into_runs, via les coordonnees GPS de
     stations-idfm.js).

  2. Un seul instantane PRIM ne suffit generalement pas a couvrir tout le
     trajet d'un train (fenetre de visibilite trop courte par gare). On
     persiste donc un historique entre les executions (data/train-tracks.json)
     : chaque run tente de rattacher ses nouvelles sequences aux "tracks"
     deja connus (meme code + continuite physique plausible), les enrichit,
     et supprime les tracks devenus obsoletes (dernier arret connu trop
     ancien). Le fichier de sortie live-trains.json est calcule a partir de
     cet historique cumule, pas seulement du dernier instantane.

     ATTENTION : le rattachement "meme gare" (cas ou le calcul de vitesse ne
     s'applique pas, coordonnees identiques) doit imperativement exiger un
     ecart de temps court (SAME_STATION_TOLERANCE_S) entre le dernier arret du
     track et le nouveau passage. Sans cette limite, des gares partagees par
     plusieurs missions finissent par fusionner des trains totalement sans
     rapport au fil des runs, corrompant l'historique.

USAGE (local, apres avoir lance fetch_prim_departures.py) :
  python3 tools/build_live_trains.py

Entree  : data/live-departures.json, js/stations-idfm.js (coordonnees),
          data/train-tracks.json (historique, cree automatiquement)
Sortie  : data/live-trains.json, data/train-tracks.json (mis a jour)
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
TRACKS_PATH = os.path.join(ROOT, "data", "train-tracks.json")
STATIONS_JS_PATH = os.path.join(ROOT, "js", "stations-idfm.js")

ARRIVED_GRACE_MINUTES = 3
TRACK_MAX_AGE_MINUTES = 90

# Duree maximale (en minutes) d'historique de arrets conserves PAR TRACK,
# relative au dernier arret connu de ce track.
MAX_STOP_HISTORY_MINUTES = 180

MAX_PLAUSIBLE_KMH = 180
SAME_STATION_TOLERANCE_S = 5 * 60  # 5 minutes


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


def implied_speed_kmh(coords, stop_a, stop_b):
    c_a = coords.get(stop_a["station"])
    c_b = coords.get(stop_b["station"])
    if not c_a or not c_b or c_a == c_b:
        return None
    dt_h = (parse_iso(stop_b["expected"]) - parse_iso(stop_a["expected"])).total_seconds() / 3600
    if dt_h <= 0:
        return None
    return haversine_km(c_a, c_b) / dt_h


def build_missions(data):
    missions = {}
    for station_key, station_data in data.get("stations", {}).items():
        for dep in station_data.get("departures", []):
            code = dep.get("code")
            if not code or code == "----":
                continue
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


def split_into_runs(mission, coords):
    stops = mission["stops"]
    if len(stops) <= 1:
        return [dict(mission, stops=list(stops))] if stops else []

    runs = [[stops[0]]]
    for prev, cur in zip(stops, stops[1:]):
        speed = implied_speed_kmh(coords, prev, cur)
        if speed is not None and speed > MAX_PLAUSIBLE_KMH:
            runs.append([cur])
        else:
            runs[-1].append(cur)

    return [dict(mission, stops=run) for run in runs]


def load_tracks():
    if not os.path.exists(TRACKS_PATH):
        return []
    try:
        with open(TRACKS_PATH, encoding="utf-8") as f:
            return json.load(f).get("tracks", [])
    except (json.JSONDecodeError, OSError):
        return []


def save_tracks(tracks):
    with open(TRACKS_PATH, "w", encoding="utf-8") as f:
        json.dump({"tracks": tracks}, f, ensure_ascii=False, separators=(",", ":"))


def merge_stops(existing_stops, new_stops):
    seen = {(s["station"], s["scheduled"]): s for s in existing_stops}
    for s in new_stops:
        seen[(s["station"], s["scheduled"])] = s
    merged = sorted(seen.values(), key=lambda s: s["scheduled"])
    if not merged:
        return merged
    cutoff = parse_iso(merged[-1]["expected"]).timestamp() - MAX_STOP_HISTORY_MINUTES * 60
    return [s for s in merged if parse_iso(s["expected"]).timestamp() >= cutoff]


def attach_runs_to_tracks(tracks, runs, coords):
    by_code = {}
    for i, track in enumerate(tracks):
        by_code.setdefault(track["code"], []).append(i)

    for run in runs:
        candidates = by_code.get(run["code"], [])
        best_idx, best_gap = None, None
        for idx in candidates:
            track = tracks[idx]
            last_stop = track["stops"][-1]
            first_new = run["stops"][0]
            speed = implied_speed_kmh(coords, last_stop, first_new)
            t_last = parse_iso(last_stop["expected"])
            t_new = parse_iso(first_new["expected"])
            gap_s = (t_new - t_last).total_seconds()
            plausible = (speed is not None and speed <= MAX_PLAUSIBLE_KMH and gap_s >= 0) \
                or (last_stop["station"] == first_new["station"] and 0 <= gap_s <= SAME_STATION_TOLERANCE_S)
            if plausible:
                gap = abs(gap_s)
                if best_gap is None or gap < best_gap:
                    best_idx, best_gap = idx, gap

        if best_idx is not None:
            track = tracks[best_idx]
            track["stops"] = merge_stops(track["stops"], run["stops"])
            track["dest"] = run["dest"]
            track["dir"] = run["dir"]
        else:
            tracks.append({
                "code": run["code"],
                "dest": run["dest"],
                "dir": run["dir"],
                "stops": list(run["stops"]),
            })
            by_code.setdefault(run["code"], []).append(len(tracks) - 1)

    return tracks


def prune_tracks(tracks, now):
    kept = []
    for track in tracks:
        if not track["stops"]:
            continue
        last_time = parse_iso(track["stops"][-1]["expected"])
        age_min = (now - last_time).total_seconds() / 60
        if age_min <= TRACK_MAX_AGE_MINUTES:
            kept.append(track)
    return kept


def locate_train(track, now):
    stops = track["stops"]
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
        return None, to_stop, 0.0, "notStarted"

    return None, None, None, "unknown"


def build_live_trains():
    data = load_departures()
    now = parse_iso(data["generatedAt"])
    coords = load_station_coords()

    missions = build_missions(data)
    new_runs = []
    for mission in missions.values():
        new_runs.extend(split_into_runs(mission, coords))

    tracks = load_tracks()
    tracks = attach_runs_to_tracks(tracks, new_runs, coords)
    tracks = prune_tracks(tracks, now)
    save_tracks(tracks)

    counts = {}
    for track in tracks:
        counts[track["code"]] = counts.get(track["code"], 0) + 1
    seen_per_code = {}

    trains = []
    for track in tracks:
        from_stop, to_stop, progress, state = locate_train(track, now)
        if state in ("expired", "unknown"):
            continue
        cancelled = any(s["status"] == "cancelled" for s in track["stops"])
        reference_stop = to_stop or from_stop
        code = track["code"]
        # "code" reste TOUJOURS le code mission brut PRIM, sans jamais de
        # suffixe visible cote client. "id" est un identifiant interne,
        # distinct, utilise UNIQUEMENT par js/trains.js pour indexer les
        # trains de facon unique meme en cas de collision de code (plusieurs
        # trains simultanes partageant le meme code PRIM) : sans cette
        # separation, deux trains distincts partageant le meme "code" se
        # retrouveraient sous la meme cle cote client, et l'un des deux
        # marqueurs disparaitrait purement et simplement de l'ecran.
        if counts[code] > 1:
            seen_per_code[code] = seen_per_code.get(code, 0) + 1
            train_id = f"{code}\u00b7{seen_per_code[code]}"
        else:
            train_id = code
        trains.append({
            "id": train_id,
            "code": code,
            "dest": track["dest"],
            "dir": track["dir"],
            "state": state,
            "cancelled": cancelled,
            "delay": reference_stop["delay"] if reference_stop else 0,
            "from": from_stop,
            "to": to_stop,
            "progress": progress,
            "stops": track["stops"],
        })

    trains.sort(key=lambda t: t["code"])
    return {"generatedAt": data["generatedAt"], "trains": trains}


def main():
    out = build_live_trains()
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    n_active = sum(1 for t in out["trains"] if t["state"] == "enRoute")
    n_waiting = sum(1 for t in out["trains"] if t["state"] == "notStarted")
    n_total = len(out["trains"])
    print(f"Ecrit : {OUT_PATH} ({n_total} trains suivis, {n_active} en circulation, {n_waiting} en attente)")


if __name__ == "__main__":
    main()
