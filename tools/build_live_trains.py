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
     simultanement sur des portions distinctes de la ligne (observe : "GOTA"
     attache a la fois a un passage vers Epinay-sur-Seine et vers Champ de
     Mars a 1 minute d'intervalle, ~650 km/h implicite). On scinde donc les
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
     plusieurs missions (ex. Gare d'Austerlitz, desservie par les 6 routes)
     finissent par fusionner des trains totalement sans rapport au fil des
     runs, corrompant l'historique (observe : 209 trains connus cote backend,
     4 seulement resolubles sur une route reelle cote navigateur).

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

# Duree pendant laquelle un train reste affiche "a quai" apres son dernier
# arret connu quand aucun arret suivant n'est encore visible dans PRIM.
ARRIVED_GRACE_MINUTES = 3

# Un track dont le dernier arret connu est plus ancien que ca est considere
# termine et est retire de l'historique persiste.
TRACK_MAX_AGE_MINUTES = 90

# Duree maximale (en minutes) d'historique de arrets conserves PAR TRACK,
# relative au dernier arret connu de ce track. Les trajets RER C les plus
# longs (traversee de branches) ne depassent pas ~100-110 min ; on garde une
# marge confortable. Sans cette purge, un track dont le "dernier arret" est
# regulierement rafraichi par des rattachements peu fiables (ex. gares
# partagees par plusieurs missions comme Austerlitz) peut accumuler des
# arrets tres anciens indefiniment et faire grossir data/live-trains.json et
# data/train-tracks.json sans limite au fil des jours.
MAX_STOP_HISTORY_MINUTES = 180

# Vitesse au-dela de laquelle deux arrets consecutifs (au sein d'un meme
# instantane OU entre un track existant et un nouveau passage) sont
# consideres comme appartenant a deux trains differents plutot qu'au meme
# train (RER C ne depasse pas ~160 km/h en pointe ; grande marge de securite).
MAX_PLAUSIBLE_KMH = 180

# Tolerance pour considerer un passage a la MEME gare comme la reobservation
# du meme arret (pas un train different) : ecart de temps maximal accepte.
# Indispensable sur les gares partagees par plusieurs routes (voir docstring).
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
    """Vitesse implicite (km/h) entre deux arrets, ou None si non calculable
    (coordonnees manquantes ou meme gare)."""
    c_a = coords.get(stop_a["station"])
    c_b = coords.get(stop_b["station"])
    if not c_a or not c_b or c_a == c_b:
        return None
    dt_h = (parse_iso(stop_b["expected"]) - parse_iso(stop_a["expected"])).total_seconds() / 3600
    if dt_h <= 0:
        return None
    return haversine_km(c_a, c_b) / dt_h


def build_missions(data):
    """Regroupe tous les passages du DERNIER instantane par code mission."""
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


def split_into_runs(mission, coords):
    """Scinde les arrets d'un code mission (dans UN instantane) en
    sous-sequences physiquement plausibles. Retourne une liste de mini-
    "mission" (memes cles que l'entree)."""
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
    # Format compact (pas d'indentation) : ces fichiers ne sont jamais lus a la
    # main, seulement par le script lui-meme et par le navigateur. L'indentation
    # gonflait inutilement la taille (~30-40%) d'un fichier deja volumineux et
    # commite toutes les quelques minutes, 24h/24.
    with open(TRACKS_PATH, "w", encoding="utf-8") as f:
        json.dump({"tracks": tracks}, f, ensure_ascii=False, separators=(",", ":"))


def merge_stops(existing_stops, new_stops):
    """Fusionne deux listes de stops, dedupliquees par (station, scheduled), triees,
    puis tronquees a MAX_STOP_HISTORY_MINUTES relatif au dernier arret connu
    (voir MAX_STOP_HISTORY_MINUTES pour la justification)."""
    seen = {(s["station"], s["scheduled"]): s for s in existing_stops}
    for s in new_stops:
        seen[(s["station"], s["scheduled"])] = s  # la version la plus recente gagne (retard a jour)
    merged = sorted(seen.values(), key=lambda s: s["scheduled"])
    if not merged:
        return merged
    cutoff = parse_iso(merged[-1]["expected"]).timestamp() - MAX_STOP_HISTORY_MINUTES * 60
    return [s for s in merged if parse_iso(s["expected"]).timestamp() >= cutoff]


def attach_runs_to_tracks(tracks, runs, coords):
    """Tente de rattacher chaque nouvelle sequence (run, issue de l'instantane
    courant) a un track existant (meme code + continuite physique plausible).
    Sinon cree un nouveau track. Modifie `tracks` en place et le retourne."""
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
            # Meme gare acceptee seulement si l'ecart de temps est court et
            # dans le bon sens : reobservation du meme arret entre deux runs
            # proches, jamais un train totalement different repasse par la
            # meme gare (frequent sur les gares partagees par plusieurs
            # routes, ex. Gare d'Austerlitz). Sans cette restriction, des
            # trains sans rapport se retrouvaient fusionnes dans un meme
            # track, corrompant l'historique.
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
    """Determine la derniere gare deja desservie (from) et la prochaine (to),
    et la fraction de trajet parcourue entre les deux."""
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
        if counts[code] > 1:
            seen_per_code[code] = seen_per_code.get(code, 0) + 1
            display_code = f"{code}\u00b7{seen_per_code[code]}"
        else:
            display_code = code
        trains.append({
            "code": display_code,
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
    # Format compact : voir commentaire de save_tracks() pour la justification.
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    n_active = sum(1 for t in out["trains"] if t["state"] == "enRoute")
    n_waiting = sum(1 for t in out["trains"] if t["state"] == "notStarted")
    n_total = len(out["trains"])
    print(f"Ecrit : {OUT_PATH} ({n_total} trains suivis, {n_active} en circulation, {n_waiting} en attente)")


if __name__ == "__main__":
    main()
