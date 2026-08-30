#!/usr/bin/env python3
"""
fetch_prim_departures.py — Interroge l'API PRIM (SIRI Lite StopMonitoring) pour
les 75 gares de la ligne C et écrit data/live-departures.json, consommé par
js/real-schedule.js dans le navigateur.

Prévu pour tourner dans une GitHub Action programmée (voir
.github/workflows/update-departures.yml), avec la clé API dans le secret de
repo PRIM_API_KEY — jamais en dur dans ce fichier.

USAGE (local, pour tester) :
  PRIM_API_KEY=xxxx python3 tools/fetch_prim_departures.py

Notes :
- Le format d'identifiant "STIF:StopArea:SP:<id>:" est celui requis pour les
  lignes exploitées par la SNCF (dont la ligne C) depuis le changement du
  13/03/2025 côté PRIM — l'ancien format StopPoint ne fonctionne plus pour
  ces lignes. <id> est le même nombre que dans stations-idfm.js
  (IDFM:monomodalStopPlace:<id>).
- Le mapping DirectionRef "Aller"/"Retour" -> notre "A"/"B" (A = vers le
  nord/ouest sur le schéma : Pontoise / Versailles-Château / Saint-Quentin)
  a été déduit d'UN SEUL échantillon réel (Choisy-le-Roi, où "Retour" menait
  vers Paris Austerlitz / Versailles-Château, et "Aller" vers Juvisy / Massy /
  Orly). À vérifier sur une gare de la branche Pontoise si possible — si
  l'ordre est inversé là-bas, adapter DIRECTION_MAP ci-dessous.
- Ne fait aucun appel si PRIM_API_KEY n'est pas défini (permet de tester le
  reste du pipeline sans clé).
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

API_URL = "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring"
LINE_REF = "STIF:Line::C01727:"
DIRECTION_MAP = {"Retour": "A", "Aller": "B"}
REQUEST_DELAY_S = 0.4  # politesse envers l'API entre deux gares

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load_stations_idfm():
    """Extrait {seg:idx: stopId} de js/stations-idfm.js sans dépendre d'un parseur JS."""
    path = os.path.join(ROOT, "js", "stations-idfm.js")
    with open(path, encoding="utf-8") as f:
        js = f.read()
    pattern = re.compile(r'"(\w+:\d+)":\s*\{\s*stopId:\s*"([^"]+)"')
    stations = dict(pattern.findall(js))
    if not stations:
        raise RuntimeError("Aucune gare trouvée dans stations-idfm.js — format inattendu ?")
    return stations


def stop_area_ref(stop_id):
    """'IDFM:monomodalStopPlace:43110' -> 'STIF:StopArea:SP:43110:'"""
    num = stop_id.rsplit(":", 1)[-1]
    return f"STIF:StopArea:SP:{num}:"


def fetch_stop_monitoring(stop_area_ref, api_key):
    url = f"{API_URL}?MonitoringRef={stop_area_ref}"
    req = urllib.request.Request(url, headers={"apikey": api_key, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def parse_departures(payload):
    try:
        deliveries = payload["Siri"]["ServiceDelivery"]["StopMonitoringDelivery"]
    except (KeyError, IndexError):
        return []
    departures = []
    for delivery in deliveries:
        for visit in delivery.get("MonitoredStopVisit", []):
            mvj = visit.get("MonitoredVehicleJourney", {})
            if mvj.get("LineRef", {}).get("value") != LINE_REF:
                continue  # gare desservie par plusieurs lignes : ne garder que la C
            mc = mvj.get("MonitoredCall", {})
            aimed = mc.get("AimedDepartureTime") or mc.get("AimedArrivalTime")
            expected = mc.get("ExpectedDepartureTime") or mc.get("ExpectedArrivalTime") or aimed
            if not aimed:
                continue
            delay_min = 0
            try:
                t_aimed = datetime.fromisoformat(aimed.replace("Z", "+00:00"))
                t_expected = datetime.fromisoformat(expected.replace("Z", "+00:00"))
                delay_min = round((t_expected - t_aimed).total_seconds() / 60)
            except Exception:
                pass

            status = mc.get("DepartureStatus") or mc.get("ArrivalStatus") or "onTime"
            status_norm = {
                "onTime": "onTime", "early": "onTime",
                "delayed": "delayed", "cancelled": "cancelled", "noReport": "onTime",
            }.get(status, "onTime")

            journey_note = mvj.get("JourneyNote", [{}])
            dest_name = mvj.get("DestinationName", [{}])
            platform = mc.get("DeparturePlatformName", {}).get("value") or mc.get("ArrivalPlatformName", {}).get("value")
            direction = DIRECTION_MAP.get(mvj.get("DirectionRef", {}).get("value"))

            departures.append({
                "code": journey_note[0].get("value", "----") if journey_note else "----",
                "dest": dest_name[0].get("value", "?") if dest_name else "?",
                "dir": direction or "B",
                "scheduled": aimed,
                "expected": expected,
                "status": status_norm,
                "delay": delay_min,
                "platform": platform,
            })
    # tri par heure théorique
    departures.sort(key=lambda d: d["scheduled"])
    return departures


def main():
    api_key = os.environ.get("PRIM_API_KEY")
    if not api_key:
        print("PRIM_API_KEY absent de l'environnement — abandon (voir le docstring).", file=sys.stderr)
        sys.exit(1)

    stations = load_stations_idfm()
    print(f"{len(stations)} gares à interroger…")

    out = {"generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "stations": {}}
    errors = 0

    for i, (key, stop_id) in enumerate(sorted(stations.items()), 1):
        ref = stop_area_ref(stop_id)
        try:
            payload = fetch_stop_monitoring(ref, api_key)
            departures = parse_departures(payload)
            out["stations"][key] = {"departures": departures}
            print(f"  [{i}/{len(stations)}] {key:14} {ref:28} -> {len(departures)} départs")
        except urllib.error.HTTPError as e:
            print(f"  [{i}/{len(stations)}] {key:14} {ref:28} -> HTTP {e.code}", file=sys.stderr)
            out["stations"][key] = {"departures": []}
            errors += 1
        except Exception as e:
            print(f"  [{i}/{len(stations)}] {key:14} {ref:28} -> ERREUR {e}", file=sys.stderr)
            out["stations"][key] = {"departures": []}
            errors += 1
        time.sleep(REQUEST_DELAY_S)

    out_path = os.path.join(ROOT, "data", "live-departures.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"\nÉcrit : {out_path}  ({errors} gare(s) en erreur sur {len(stations)})")
    # on n'échoue le job que si TOUTES les gares sont en erreur (ex: clé invalide)
    if errors == len(stations):
        sys.exit(1)


if __name__ == "__main__":
    main()
