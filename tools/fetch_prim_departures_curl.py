#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

API_URL = "https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring"
LINE_REF = "STIF:Line::C01727:"
DIRECTION_MAP = {"Retour": "A", "Aller": "B"}
REQUEST_DELAY_S = 0.4

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def load_stations_idfm():
    path = os.path.join(ROOT, "js", "stations-idfm.js")
    with open(path, encoding="utf-8") as f:
        js = f.read()
    pattern = re.compile(r'"(\w+:\d+)":\s*\{\s*stopId:\s*"([^"]+)"')
    stations = dict(pattern.findall(js))
    if not stations:
        raise RuntimeError("Aucune gare trouvee dans stations-idfm.js")
    return stations

def stop_area_ref(stop_id):
    num = stop_id.rsplit(":", 1)[-1]
    return f"STIF:StopArea:SP:{num}:"

def fetch_stop_monitoring_curl(stop_area_ref, api_key):
    url = f"{API_URL}?MonitoringRef={stop_area_ref}"
    cmd = ["curl", "-s", "-H", f"apikey: {api_key}", "-H", "Accept: application/json", url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
    if result.returncode != 0:
        raise RuntimeError(f"curl a echoue : {result.stderr.strip()}")
    return json.loads(result.stdout)

def extract_journey_ref(mvj):
    framed = mvj.get("FramedVehicleJourneyRef") or {}
    return framed.get("DatedVehicleJourneyRef") or None

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
                continue
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
            status_norm = {"onTime": "onTime", "early": "onTime", "delayed": "delayed", "cancelled": "cancelled", "noReport": "onTime"}.get(status, "onTime")
            journey_note = mvj.get("JourneyNote", [{}])
            dest_name = mvj.get("DestinationName", [{}])
            platform = mc.get("DeparturePlatformName", {}).get("value") or mc.get("ArrivalPlatformName", {}).get("value")
            direction = DIRECTION_MAP.get(mvj.get("DirectionRef", {}).get("value"))
            journey_ref = extract_journey_ref(mvj)
            vehicle_journey_name = mvj.get("VehicleJourneyName", [{}])
            departures.append({
                "code": journey_note[0].get("value", "----") if journey_note else "----",
                "journeyRef": journey_ref,
                "trainNumber": vehicle_journey_name[0].get("value") if vehicle_journey_name else None,
                "dest": dest_name[0].get("value", "?") if dest_name else "?",
                "dir": direction or "B",
                "scheduled": aimed,
                "expected": expected,
                "status": status_norm,
                "delay": delay_min,
                "platform": platform,
            })
    departures.sort(key=lambda d: d["scheduled"])
    return departures

def main():
    api_key = os.environ.get("PRIM_API_KEY")
    if not api_key:
        print("PRIM_API_KEY absent", file=sys.stderr)
        sys.exit(1)
    stations = load_stations_idfm()
    print(f"{len(stations)} gares a interroger...")
    out = {"generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "stations": {}}
    errors = 0
    missing_journey_ref = 0
    for i, (key, stop_id) in enumerate(sorted(stations.items()), 1):
        ref = stop_area_ref(stop_id)
        try:
            payload = fetch_stop_monitoring_curl(ref, api_key)
            departures = parse_departures(payload)
            missing_journey_ref += sum(1 for d in departures if not d.get("journeyRef"))
            out["stations"][key] = {"departures": departures}
            print(f"  [{i}/{len(stations)}] {key:14} {ref:28} -> {len(departures)} departs")
        except Exception as e:
            print(f"  [{i}/{len(stations)}] {key:14} {ref:28} -> ERREUR {e}", file=sys.stderr)
            out["stations"][key] = {"departures": []}
            errors += 1
        time.sleep(REQUEST_DELAY_S)
    out_path = os.path.join(ROOT, "data", "live-departures.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\nEcrit : {out_path} ({errors} gare(s) en erreur sur {len(stations)})")
    if missing_journey_ref:
        print(f"ATTENTION : {missing_journey_ref} depart(s) sans journeyRef.", file=sys.stderr)
    if errors == len(stations):
        sys.exit(1)

if __name__ == "__main__":
    main()
