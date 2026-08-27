# RER-visu

Visualisation "live" de la ligne RER C sous forme de schéma topologique (style plan RATP/SNCF), alimentée par l'API temps réel PRIM (IDFM).

## Principe

- `rer_c_schema.json` : graphe des 84 gares de la ligne C avec coordonnées schématiques (pas de fond de carte), reproduisant la vraie topologie en boucle (tronc commun Javel-Choisy-le-Roi, triple convergence vers Massy-Palaiseau, antènes Pontoise / Versailles-Château / Saint-Quentin / Dourdan / Saint-Martin-d'Étampes).
- `rer_c_live_schema_poller.py` : interroge l'API PRIM `estimated-timetable` toutes les 60s, retrouve pour chaque train sa gare précédente/suivante, et calcule sa position par interpolation le long du segment du graphe. Écrit le résultat dans `positions.json`.
- `index.html` : page SVG pure qui dessine le schéma et anime les trains à partir de `positions.json`.
- `positions.json` : fichier placéholder (vide), remplacé automatiquement quand le poller tourne.

## Installation

```bash
pip install -r requirements.txt
export PRIM_API_KEY="votre_token_PRIM"
python rer_c_live_schema_poller.py
```

Dans un autre terminal, à la racine du repo :

```bash
python3 -m http.server 8000
```

Puis ouvrez http://localhost:8000/index.html

**Important** : n'ouvrez jamais `index.html` directement en double-cliquant (`file://`) - les navigateurs bloquent les appels `fetch()` locaux par sécurité CORS. Il faut passer par un serveur HTTP local.

## Limites connues

- PRIM ne fournit pas de position GPS réelle des trains RER/Transilien (contrairement aux bus) : la position affichée est une interpolation entre les horaires estimés de la gare précédente et de la gare suivante, pas une géolocalisation live.
- Le format exact de la réponse JSON de l'API `estimated-timetable` doit être validé avec un vrai token (structure SIRI Lite, chaînes exactes des noms de gares) et le parsing dans `rer_c_live_schema_poller.py` ajusté en conséquence.
- Certains segments de la ligne C partagent des tronçons entre plusieurs missions (lettres A, B, C, D...) : pour différencier les branches par couleur, il faudra exploiter `DatedVehicleJourneyRef` / le nom de mission renvoyé par l'API.

## Licence

Projet personnel / prototype. Données PRIM soumises aux conditions d'utilisation d'Ile-de-France Mobilités.
