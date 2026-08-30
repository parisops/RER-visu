#!/usr/bin/env python3
"""
filter_gtfs.py — Réduit l'export GTFS complet IDFM (tous modes, plusieurs Go) aux
seules données de la ligne C du RER.

USAGE :
  1. Téléchargez le zip depuis l'URL trouvée dans offre-horaires-tc-gtfs-idfm.csv
     (portail data.iledefrance-mobilites.fr — nécessite d'être fait depuis votre
     machine, ce sandbox n'a pas accès à ce domaine).
  2. python3 filter_gtfs.py chemin/vers/IDFM_gtfs.zip ./gtfs-c/

Ça produit dans ./gtfs-c/ des CSV bien plus légers (quelques Mo) :
  routes.csv, trips.csv, stop_times.csv, calendar.csv, calendar_dates.csv, stops.csv
ne contenant que les lignes liées à route_short_name == "C".

Renvoyez-moi ce dossier ./gtfs-c/ (ou juste ces fichiers) et je m'occupe de les
intégrer dans real-schedule.js.
"""
import csv, sys, zipfile, os

def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    zip_path, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    with zipfile.ZipFile(zip_path) as z:
        def read_csv(name):
            with z.open(name) as f:
                text = f.read().decode('utf-8-sig')
            return list(csv.DictReader(text.splitlines()))

        routes = read_csv('routes.txt')
        c_routes = [r for r in routes if r.get('route_short_name') == 'C']
        route_ids = {r['route_id'] for r in c_routes}
        print(f"routes matching 'C': {len(c_routes)}")

        trips = read_csv('trips.txt')
        c_trips = [t for t in trips if t['route_id'] in route_ids]
        trip_ids = {t['trip_id'] for t in c_trips}
        print(f"trips: {len(c_trips)}")

        service_ids = {t['service_id'] for t in c_trips}

        # stop_times.txt is usually huge — stream it instead of loading fully
        st_out = []
        with z.open('stop_times.txt') as f:
            text = f.read().decode('utf-8-sig')
        reader = csv.DictReader(text.splitlines())
        for row in reader:
            if row['trip_id'] in trip_ids:
                st_out.append(row)
        print(f"stop_times: {len(st_out)}")

        stop_ids = {r['stop_id'] for r in st_out}

        stops = read_csv('stops.txt')
        c_stops = [s for s in stops if s['stop_id'] in stop_ids]
        print(f"stops: {len(c_stops)}")

        calendar = read_csv('calendar.txt')
        c_calendar = [c for c in calendar if c['service_id'] in service_ids]

        try:
            calendar_dates = read_csv('calendar_dates.txt')
            c_calendar_dates = [c for c in calendar_dates if c['service_id'] in service_ids]
        except KeyError:
            c_calendar_dates = []

        def write_csv(name, rows):
            if not rows:
                return
            with open(os.path.join(out_dir, name), 'w', newline='', encoding='utf-8') as f:
                w = csv.DictWriter(f, fieldnames=rows[0].keys())
                w.writeheader()
                w.writerows(rows)

        write_csv('routes.csv', c_routes)
        write_csv('trips.csv', c_trips)
        write_csv('stop_times.csv', st_out)
        write_csv('stops.csv', c_stops)
        write_csv('calendar.csv', c_calendar)
        write_csv('calendar_dates.csv', c_calendar_dates)

    print(f"\nOK — fichiers écrits dans {out_dir}/")

if __name__ == '__main__':
    main()
