"""
Poller PRIM (IDFM) pour la ligne RER C - positions "live" sur un schéma vectoriel (pas de fond de carte).

Usage:
  export PRIM_API_KEY="votre_token"
  python rer_c_live_schema_poller.py

Nécessite:
  pip install requests

Principe:
  1. Charge le graphe schématique (rer_c_schema.json) : gares -> (x, y) abstraits + segments.
  2. Interroge l'API "estimated-timetable" PRIM filtrée sur STIF:Line::C01727:
  3. Pour chaque train, repère la gare précédente/suivante et interpole sa position (x, y)
     le long du segment correspondant, en fonction du temps écoulé.
  4. Écrit positions.json, consommé par le frontend SVG (index.html).
"""

import os
import time
import json
import requests
from datetime import datetime, timezone

PRIM_API_KEY = os.environ.get("PRIM_API_KEY", "")
LINE_REF = "STIF:Line::C01727:"
BASE_URL = "https://prim.iledefrance-mobilites.fr/marketplace/estimated-timetable"
HEADERS = {"apikey": PRIM_API_KEY, "Accept": "application/json"}

with open("rer_c_schema.json", "r", encoding="utf-8") as f:
    SCHEMA = json.load(f)

STATIONS = SCHEMA["stations"]
SEGMENTS = {frozenset(s) for s in SCHEMA["segments"]}


def fetch_estimated_timetable():
    resp = requests.get(BASE_URL, headers=HEADERS, params={"LineRef": LINE_REF}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def parse_time(iso_str):
    if not iso_str:
        return None
    return datetime.fromisoformat(iso_str.replace("Z", "+00:00"))


def interpolate_xy(p1, p2, ratio):
    ratio = max(0.0, min(1.0, ratio))
    return {
        "x": p1["x"] + (p2["x"] - p1["x"]) * ratio,
        "y": p1["y"] + (p2["y"] - p1["y"]) * ratio,
    }


def extract_positions(payload):
    trains = []
    try:
        deliveries = payload["Siri"]["ServiceDelivery"]["EstimatedTimetableDelivery"]
        frames = deliveries[0]["EstimatedJourneyVersionFrame"]
    except (KeyError, IndexError, TypeError):
        return trains

    now = datetime.now(timezone.utc)

    for frame in frames:
        for journey in frame.get("EstimatedVehicleJourney", []):
            calls = journey.get("EstimatedCalls", {}).get("EstimatedCall", [])
            prev_call, next_call = None, None

            for call in calls:
                arr = parse_time(call.get("ExpectedArrivalTime") or call.get("AimedArrivalTime"))
                if arr is None:
                    continue
                (prev_call, next_call) = (call, next_call) if arr <= now else (prev_call, call)
                if arr > now:
                    break

            if not prev_call or not next_call:
                continue

            name_prev = prev_call.get("StopPointName", [{}])[0].get("value", "")
            name_next = next_call.get("StopPointName", [{}])[0].get("value", "")

            if name_prev not in STATIONS or name_next not in STATIONS:
                continue
            if frozenset({name_prev, name_next}) not in SEGMENTS:
                continue

            t_prev = parse_time(prev_call.get("ExpectedDepartureTime") or prev_call.get("AimedDepartureTime"))
            t_next = parse_time(next_call.get("ExpectedArrivalTime") or next_call.get("AimedArrivalTime"))
            if not t_prev or not t_next or t_next <= t_prev:
                continue

            ratio = (now - t_prev).total_seconds() / (t_next - t_prev).total_seconds()
            pos = interpolate_xy(STATIONS[name_prev], STATIONS[name_next], ratio)

            trains.append({
                "id": journey.get("DatedVehicleJourneyRef", "unknown"),
                "mission": journey.get("VehicleJourneyName", [{}])[0].get("value", ""),
                "from": name_prev,
                "to": name_next,
                "x": pos["x"],
                "y": pos["y"],
                "updated_at": now.isoformat(),
            })

    return trains


def main():
    if not PRIM_API_KEY:
        raise SystemExit("Définissez la variable d'environnement PRIM_API_KEY avec votre token PRIM.")

    while True:
        try:
            payload = fetch_estimated_timetable()
            trains = extract_positions(payload)
            with open("positions.json", "w", encoding="utf-8") as f:
                json.dump({"trains": trains, "generated_at": datetime.now().isoformat()}, f, ensure_ascii=False, indent=2)
            print(f"{len(trains)} trains positionnés - {datetime.now().isoformat()}")
        except requests.RequestException as e:
            print(f"Erreur API PRIM: {e}")

        time.sleep(60)


if __name__ == "__main__":
    main()
