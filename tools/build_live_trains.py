#!/usr/bin/env python3
"""
build_live_trains.py — Reconstruit la position de chaque train RER C a partir
de data/live-departures.json (sortie de fetch_prim_departures.py) et ecrit
data/live-trains.json, consomme par js/trains.js pour l'animation "suivi des
trains".

Version simplifiee (post-bugfix journeyRef) : chaque circulation est
identifiee de facon unique et stable par son "journeyRef"
(FramedVehicleJourneyRef.DatedVehicleJourneyRef, expose par l'API PRIM).
On regroupe donc directement les arrets par journeyRef, sans aucune
heuristique de vitesse implicite, sans cohherence de route, et sans
historique persistant entre executions (train-tracks.json est desormais
inutile et n'est plus lu ni ecrit).

USAGE (local, apres avoir lance fetch_prim_departures.py) :
  python3 tools/build_live_trains.py

Entree  : data/live-departures.json
Sortie  : data/live-trains.json
"""
import json
import os
import re
import unicodedata
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IN_PATH = os.path.join(ROOT, "data", "live-departures.json")
OUT_PATH = os.path.join(ROOT, "data", "live-trains.json")
STATIONS_JS_PATH = os.path.join(ROOT, "js", "stations-idfm.js")
DATA_JS_PATH = os.path.join(ROOT, "js", "data.js")

ARRIVED_GRACE_MINUTES = 3


def parse_iso(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def load_departures():
    with open(IN_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_station_coords():
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


def norm_name(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def load_route_maps():
    with open(DATA_JS_PATH, encoding="utf-8") as f:
        js = f.read()
    seg = {}
    seg_match = re.search(r"const SEG\s*=\s*\{(.*?)\n\};", js, re.DOTALL)
    if seg_match:
        for name, arr in re.findall(r'(\w+):\s*\[(.*?)\]', seg_match.group(1), re.DOTALL):
            stations = re.findall(r'"((?:[^"\\]|\\.)*)"', arr)
            seg[name] = [s.replace('\"', '"') for s in stations]
    routes = {}
    for route_key, milestones_blob in re.findall(r'"(R\d)":\s*\{.*?"milestones":\s*\{(.*?)\}', js, re.DOTALL):
        name_index = {}
        for idx, name in re.findall(r'"(\d+)":\s*"((?:[^"\\]|\\.)*)"', milestones_blob):
            name_index[norm_name(name.replace('\"', '"'))] = int(idx)
        routes[route_key] = name_index
    return seg, routes


def station_key_to_name(seg, station_key):
    if not station_key or ":" not in station_key:
        return None
    seg_name, idx = station_key.rsplit(":", 1)
    arr = seg.get(seg_name)
    try:
        idx = int(idx)
    except ValueError:
        return None
    if arr and 0 <= idx < len(arr):
        return arr[idx]
    return None


def resolve_route_for_stops(seg, routes, stops):
    names = [station_key_to_name(seg, s["station"]) for s in stops]
    normed = [norm_name(n) for n in names if n]
    if len(normed) <= 1:
        return None
    for route_key, name_index in routes.items():
        indices = [name_index.get(n) for n in normed]
        if any(i is None for i in indices):
            continue
        increasing = all(indices[i] > indices[i - 1] for i in range(1, len(indices)))
        decreasing = all(indices[i] < indices[i - 1] for i in range(1, len(indices)))
        if increasing or decreasing:
            return (route_key, indices)
    return None


def build_live_trains():
    data = load_departures()
    now = parse_iso(data["generatedAt"])
    seg, routes = load_route_maps()

    by_journey = {}
    for station_key, station_data in data.get("stations", {}).items():
        for dep in station_data.get("departures", []):
            jref = dep.get("journeyRef")
            if not jref:
                jref = (dep.get("code"), dep["scheduled"])
            stop = {
                "station": station_key,
                "scheduled": dep["scheduled"],
                "expected": dep["expected"],
                "status": dep.get("status", "onTime"),
                "delay": dep.get("delay", 0),
                "platform": dep.get("platform"),
            }
            entry = by_journey.setdefault(jref, {
                "journeyRef": jref,
                "code": dep["code"],
                "trainNumber": dep.get("trainNumber"),
                "dest": dep["dest"],
                "dir": dep["dir"],
                "stops": [],
            })
            entry["stops"].append(stop)

    trains = []
    for jref, entry in by_journey.items():
        entry["stops"].sort(key=lambda s: s["expected"])
        if not entry["stops"]:
            continue
        resolved = resolve_route_for_stops(seg, routes, entry["stops"])
        route_key = resolved[0] if resolved else None

        past = [s for s in entry["stops"] if parse_iso(s["expected"]) <= now]
        future = [s for s in entry["stops"] if parse_iso(s["expected"]) > now]
        from_stop = past[-1] if past else None
        to_stop = future[0] if future else None

        if from_stop and to_stop:
            t_from = parse_iso(from_stop["expected"])
            t_to = parse_iso(to_stop["expected"])
            span = (t_to - t_from).total_seconds()
            progress = (now - t_from).total_seconds() / span if span > 0 else 0.0
            state = "enRoute"
        elif from_stop and not to_stop:
            t_from = parse_iso(from_stop["expected"])
            elapsed_min = (now - t_from).total_seconds() / 60
            state = "arrived" if elapsed_min <= ARRIVED_GRACE_MINUTES else "expired"
            progress = 1.0 if state == "arrived" else None
        elif to_stop and not from_stop:
            state = "notStarted"
            progress = 0.0
        else:
            state = "expired"
            progress = None

        if state == "expired":
            continue

        cancelled = any(s["status"] == "cancelled" for s in entry["stops"])
        reference_stop = to_stop or from_stop

        trains.append({
            "journeyRef": entry["journeyRef"] if isinstance(entry["journeyRef"], str) else None,
            "code": entry["code"],
            "trainNumber": entry["trainNumber"],
            "dest": entry["dest"],
            "dir": entry["dir"],
            "state": state,
            "cancelled": cancelled,
            "delay": reference_stop["delay"] if reference_stop else 0,
            "from": from_stop,
            "to": to_stop,
            "progress": progress,
            "stops": entry["stops"],
            "route": route_key,
        })

    trains.sort(key=lambda t: (t["code"], t["dest"], t["dir"]))
    return {"generatedAt": data["generatedAt"], "trains": trains}


def main():
    out = build_live_trains()
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    n_active = sum(1 for t in out["trains"] if t["state"] == "enRoute")
    n_waiting = sum(1 for t in out["trains"] if t["state"] == "notStarted")
    n_total = len(out["trains"])
    print(f"Ecrit : {OUT_PATH} ({n_total} trains suivis, {n_active} en circulation, {n_waiting} en attente)")


if __name__ == "__main__":
    main()
