#!/usr/bin/env python3
"""
mine_destinations.py — Reconstruit destinations-observed.js à partir des vraies
destinations observées dans le GTFS statique (trips.csv + stop_times.csv, filtrés
sur route_id == IDFM:C01727 par filter_gtfs.py), croisées avec js/stations-idfm.js.

Pour chaque gare interne (seg:idx), regarde tous les trajets réels qui la
desservent et, pour les deux sens (A = vers le nord/ouest sur le schéma,
B = vers le sud), compte la fréquence de chaque destination finale réellement
observée. C'est beaucoup plus riche que les 6 termini de branche : plein de
trajets se terminent en cours de route (Juvisy, Montigny - Beauchamp, Brétigny,
Gare d'Austerlitz, Invalides, Bibliothèque François Mitterrand...).

USAGE :
  python3 mine_destinations.py ./gtfs-c/ ../js/stations-idfm.js ../js/data.js > ../js/destinations-observed.js

(Le sens A/B est déterminé en comparant, pour chaque gare traversée par un
trajet, la position verticale du schéma (calculée comme dans le générateur du
diagramme) de la destination finale de ce trajet par rapport à la gare — plus
petit = A (nord/ouest), plus grand = B (sud).)
"""
import csv, json, re, sys

ROWH = 40
PAD_TOP = 40
WEST_EXTRA_GAP = 46

def compute_station_y(SEG):
    def spine_y(i): return PAD_TOP + i * ROWH
    champ_de_mars_y = spine_y(20)
    choisy_y = spine_y(30)
    bretigny_y = spine_y(39)
    n_west = len(SEG['west'])
    west_last_y = champ_de_mars_y - ROWH
    west_start_y = west_last_y - (n_west - 1) * ROWH - WEST_EXTRA_GAP
    def west_y(i):
        y = west_start_y + i * ROWH
        if i >= 3: y += WEST_EXTRA_GAP
        return y
    spur_y = west_y(2) + ROWH / 2 + WEST_EXTRA_GAP / 2 + 6
    def orly_y(i): return choisy_y + ROWH + i * ROWH
    def dourdan_y(i): return bretigny_y + ROWH + i * ROWH
    def etampes_y(i): return bretigny_y + ROWH + i * ROWH
    Y = {}
    for i in range(len(SEG['spine'])): Y[f"spine:{i}"] = spine_y(i)
    for i in range(len(SEG['west'])): Y[f"west:{i}"] = west_y(i)
    Y["spur:0"] = spur_y
    for i in range(len(SEG['orly'])): Y[f"orly:{i}"] = orly_y(i)
    for i in range(len(SEG['dourdan'])): Y[f"dourdan:{i}"] = dourdan_y(i)
    for i in range(len(SEG['etampes'])): Y[f"etampes:{i}"] = etampes_y(i)
    return Y

def load_seg_from_data_js(path):
    # extraction minimale : on ne veut que les longueurs des tableaux SEG.*
    with open(path, encoding='utf-8') as f:
        js = f.read()
    m = re.search(r"const SEG\s*=\s*(\{.*?\n\});", js, re.S)
    obj_text = m.group(1)
    # évalue en JSON en retirant les virgules finales / commentaires simples
    obj_text = re.sub(r",\s*([\]}])", r"\1", obj_text)
    return json.loads(obj_text)

def main():
    if len(sys.argv) != 4:
        print(__doc__); sys.exit(1)
    gtfs_dir, stations_idfm_path, data_js_path = sys.argv[1:4]

    SEG = load_seg_from_data_js(data_js_path)
    Y = compute_station_y(SEG)

    # charge stations-idfm.js (stopId -> seg:idx) via une extraction JSON simple
    with open(stations_idfm_path, encoding='utf-8') as f:
        js = f.read()
    m = re.search(r"const STATIONS_IDFM\s*=\s*(\{.*\});", js, re.S)
    obj_text = m.group(1)
    obj_text = re.sub(r"(\w+):", r'"\1":', obj_text)   # clés non quotées -> quotées
    obj_text = re.sub(r",\s*}", "}", obj_text)
    stations_idfm = json.loads(obj_text)
    stopid_to_key = {v['stopId']: k for k, v in stations_idfm.items()}

    with open(f"{gtfs_dir}/stops.csv", encoding='utf-8-sig') as f:
        stop_names = {r['stop_id']: r['stop_name'] for r in csv.DictReader(f)}

    with open(f"{gtfs_dir}/trips.csv", encoding='utf-8-sig') as f:
        trip_ids = {r['trip_id'] for r in csv.DictReader(f) if r['route_id'] == 'IDFM:C01727'}

    from collections import defaultdict, Counter
    trip_pts = defaultdict(list)
    with open(f"{gtfs_dir}/stop_times.csv", encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            if r['trip_id'] in trip_ids:
                trip_pts[r['trip_id']].append((int(r['stop_sequence']), r['stop_id']))

    dest_counts = defaultdict(lambda: {'A': Counter(), 'B': Counter()})
    for tid, pts in trip_pts.items():
        pts.sort()
        seq = [p[1] for p in pts]
        final_key = stopid_to_key.get(seq[-1])
        final_y = Y.get(final_key)
        final_name = stop_names.get(seq[-1], seq[-1])
        for i, sid in enumerate(seq[:-1]):
            key = stopid_to_key.get(sid)
            if not key: continue
            y0 = Y[key]
            target_y = final_y if final_y is not None else Y.get(stopid_to_key.get(seq[i+1]))
            if target_y is None: continue
            direction = 'A' if target_y < y0 else 'B'
            dest_counts[key][direction][final_name] += 1

    out = {k: {'A': v['A'].most_common(8), 'B': v['B'].most_common(8)} for k, v in dest_counts.items()}

    print("/* Régénéré par tools/mine_destinations.py — voir ce fichier pour la méthode. */")
    print("const OBSERVED_DESTINATIONS = " + json.dumps(out, ensure_ascii=False, indent=2) + ";")

if __name__ == '__main__':
    main()
