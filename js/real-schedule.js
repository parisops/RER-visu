/*
 * real-schedule.js — Fournisseur de départs RÉELS, à charger à la place de
 * mock-schedule.js une fois les données temps réel disponibles.
 *
 * Ce fichier NE PARLE PAS directement à l'API PRIM (clé API à ne jamais exposer
 * côté navigateur + CORS). Il lit un fichier statique déjà calculé côté serveur :
 *
 *     data/live-departures.json
 *
 * ... généré périodiquement par tools/fetch_prim_departures.py (voir la GitHub
 * Action .github/workflows/update-departures.yml), qui interroge l'API PRIM
 * StopMonitoring pour les 75 gares et écrit un JSON compact au même format que
 * ce que produit buildDepartures() en simulation.
 *
 * Format attendu de data/live-departures.json :
 *   {
 *     "generatedAt": "2026-08-30T14:42:46Z",
 *     "stations": {
 *       "spine:30": {
 *         "stationName": "Choisy-le-Roi",
 *         "departures": [
 *           {"code":"ZORU","dest":"Paris Austerlitz","dir":"A",
 *            "scheduled":"2026-08-30T14:49:20.000Z",
 *            "expected":"2026-08-30T14:50:18.000Z",
 *            "status":"ontime","delay":0,"platform":"2T"},
 *           ...
 *         ]
 *       }, ...
 *     }
 *   }
 *
 * >>> Interface exposée (doit rester identique à mock-schedule.js) : <<<
 *   - getDirections(seg, idx)   -> Promise<{A:[[dest,poids],...]|null, B:[...]|null}>
 *   - buildDepartures(seg, idx) -> Promise<tableau de trains {code,dest,dir,scheduled,status,delay,position}>
 *   - randomPosition(seg, idx)  -> {text, unknown}  (repli si pas de quai connu)
 *   - pick / pad / fmtTime      -> identiques à mock-schedule.js, réutilisés par panel.js / trains.js
 *
 * panel.js gère déjà le cas où buildDepartures() renvoie une Promise (voir
 * renderSheet() -> Promise.resolve(buildDepartures(...))), donc AUCUN autre
 * fichier n'a besoin de changer pour passer du mock au réel — il suffit de
 * remplacer, dans index.html, le <script src="js/mock-schedule.js"> par
 * <script src="js/real-schedule.js">.
 *
 * Dépend de : data.js (SEG, ROUTES), stations-idfm.js (pour le nom de repli des gares)
 */

const IS_LIVE = true;

const LIVE_DATA_URL = 'data/live-departures.json';
let liveDataPromise = null;

function loadLiveData(){
  if(!liveDataPromise){
    liveDataPromise = fetch(LIVE_DATA_URL, {cache: 'no-store'})
      .then(r => {
        if(!r.ok) throw new Error('HTTP ' + r.status + ' sur ' + LIVE_DATA_URL);
        return r.json();
      })
      .catch(err => {
        liveDataPromise = null; // permet de réessayer au prochain appel
        throw err;
      });
  }
  return liveDataPromise;
}

function pad(n){ return n.toString().padStart(2,'0'); }
function fmtTime(d){ return pad(d.getHours())+':'+pad(d.getMinutes()); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// Pas de position GPS en temps réel pour le rail lourd (contrairement aux bus) —
// on affiche le numéro de voie/quai quand l'API le fournit, sinon "non disponible".
function randomPosition(seg, idx){
  return {text: "Information non disponible", unknown: true};
}

function platformPosition(platform){
  if(!platform) return {text: "Information non disponible", unknown: true};
  return {text: "Voie " + platform, unknown: false};
}

// --- Position réelle en circulation, via data/live-trains.json --------------
//
// Réutilise EXACTEMENT la même logique que trains.js (resolveRoute,
// ciFromWaypoints, positionText) plutôt qu'un simple "entre from et to" basé
// sur les arrêts bruts observés par PRIM. Nécessaire car PRIM ne voit chaque
// gare que sur une fenêtre de 30-60 min : les arrêts observés pour UN train
// donné ont souvent des trous (ex. Grésillons observé, puis directement
// Saint-Michel Notre-Dame 10 gares plus loin, sans que les gares
// intermédiaires n'aient été captées). Utiliser from/to bruts affichait donc
// des paires de gares très éloignées au lieu de gares réellement adjacentes.
// En passant par le tracé complet (ROUTES[Rx].milestones) et en interpolant
// l'heure courante entre TOUS les waypoints connus, on retrouve toujours les
// deux gares immédiatement adjacentes sur la ligne, comme le fait déjà le
// marqueur animé sur le schéma.
const LIVE_TRAINS_URL = 'data/live-trains.json';
let liveTrainsRawPromise = null;

function stationKeyToName(stationKey){
  if(!stationKey) return null;
  const sepIdx = stationKey.lastIndexOf(':');
  if(sepIdx === -1) return null;
  const seg = stationKey.slice(0, sepIdx);
  const idx = Number(stationKey.slice(sepIdx + 1));
  const arr = SEG[seg];
  return (arr && arr[idx]) || null;
}

function normName(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const _routeNameIndexCache = {};
function routeNameIndex(routeKey) {
  if (_routeNameIndexCache[routeKey]) return _routeNameIndexCache[routeKey];
  const route = ROUTES[routeKey];
  const map = {};
  Object.keys(route.milestones).forEach(idx => {
    map[normName(route.milestones[idx])] = Number(idx);
  });
  _routeNameIndexCache[routeKey] = map;
  return map;
}

// Identique à resolveRoute() de trains.js : trouve la route (R1..R6) qui
// contient TOUTES les gares connues du train, dans le bon ordre.
function resolveRouteForStops(stops) {
  const names = stops.map(s => stationKeyToName(s.station)).filter(Boolean);
  if (names.length === 0) return null;
  const normed = names.map(normName);

  let best = null;
  for (const routeKey of Object.keys(ROUTES)) {
    const nameIndex = routeNameIndex(routeKey);
    const indices = normed.map(n => nameIndex[n]);
    if (indices.some(ix => ix === undefined)) continue;
    let increasing = true, decreasing = true;
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] <= indices[i - 1]) increasing = false;
      if (indices[i] >= indices[i - 1]) decreasing = false;
    }
    if (!increasing && !decreasing) continue;
    if (!best || indices.length > best.indices.length) {
      best = { routeKey, indices };
    }
  }
  return best;
}

// Identique à ciFromWaypoints() de trains.js.
function ciFromWaypoints(waypoints, now) {
  if (!waypoints || waypoints.length === 0) return null;
  if (now <= waypoints[0].time) return waypoints[0].ci;
  let i = 0;
  while (i < waypoints.length - 1 && waypoints[i + 1].time <= now) i++;
  if (i >= waypoints.length - 1) return waypoints[waypoints.length - 1].ci;
  const a = waypoints[i], b = waypoints[i + 1];
  const span = b.time - a.time;
  const frac = span > 0 ? Math.max(0, Math.min(1, (now - a.time) / span)) : 1;
  return a.ci + (b.ci - a.ci) * frac;
}

// Identique à positionText() de trains.js : donne "En gare de X" ou
// "Entre X et Y" (toujours deux gares adjacentes sur le tracé).
function positionTextFromCi(milestones, ci) {
  const keys = Object.keys(milestones).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) return null;
  let below = null, above = null;
  for (const k of keys) {
    if (k <= ci) below = k;
    if (k >= ci && above === null) above = k;
  }
  const EPS = 0.6;
  if (below !== null && Math.abs(ci - below) < EPS) return 'En gare de ' + milestones[below];
  if (above !== null && Math.abs(above - ci) < EPS) return 'En gare de ' + milestones[above];
  if (below !== null && above !== null && below !== above) {
    return 'Entre ' + milestones[below] + ' et ' + milestones[above];
  }
  if (below !== null) return 'Après ' + milestones[below];
  if (above !== null) return 'Avant ' + milestones[above];
  return null;
}

function loadLiveTrainsRaw(){
  if(!liveTrainsRawPromise){
    liveTrainsRawPromise = fetch(LIVE_TRAINS_URL, {cache: 'no-store'})
      .then(r => {
        if(!r.ok) throw new Error('HTTP ' + r.status + ' sur ' + LIVE_TRAINS_URL);
        return r.json();
      })
      .then(payload => {
        const index = new Map();
        (payload.trains || []).forEach(t => {
          (t.stops || []).forEach(s => {
            index.set(s.station + '|' + s.scheduled, t);
          });
        });
        return index;
      })
      .catch(err => {
        liveTrainsRawPromise = null;
        console.warn('live-trains.json indisponible pour le calcul de position :', err);
        return new Map();
      });
  }
  return liveTrainsRawPromise;
}

function runningPositionText(train){
  if(!train || train.cancelled) return null;
  const stops = train.stops || [];
  const resolved = resolveRouteForStops(stops);
  if(!resolved) return null;
  const route = ROUTES[resolved.routeKey];
  const waypoints = stops
    .map((s, i) => ({ ci: resolved.indices[i], time: new Date(s.expected).getTime() }))
    .filter(w => Number.isFinite(w.ci) && Number.isFinite(w.time))
    .sort((a, b) => a.time - b.time);
  if(waypoints.length === 0) return null;
  const ci = ciFromWaypoints(waypoints, Date.now());
  if(ci === null) return null;
  return positionTextFromCi(route.milestones, ci);
}

// Reconstruit un pool de destinations pondéré {A,B} à partir des départs déjà
// récupérés pour cette gare (utile pour les boutons de filtre Nord/Sud, qui
// n'ont besoin que de savoir si A et/ou B existent réellement pour cette gare).
function getDirections(seg, idx){
  return loadLiveData().then(data => {
    const entry = data.stations[seg + ':' + idx];
    const departures = entry ? entry.departures : [];
    const A = departures.filter(d => d.dir === 'A').map(d => [d.dest, 1]);
    const B = departures.filter(d => d.dir === 'B').map(d => [d.dest, 1]);
    return {A: A.length ? A : null, B: B.length ? B : null};
  });
}

function mapStatus(d){
  // DepartureStatus SIRI : "onTime" | "early" | "delayed" | "cancelled" | "noReport"
  // On garde une petite tolérance (< 2 min) : l'écart aimed/expected brut est
  // souvent juste du bruit de precision, pas un vrai retard perçu.
  if(d.status === 'cancelled') return {status: 'cancelled', delay: 0};
  const delay = Math.round(d.delay || 0);
  if(d.status === 'delayed' || delay >= 2){
    return {status: delay >= 10 ? 'verylate' : 'late', delay};
  }
  return {status: 'ontime', delay: 0};
}

function buildDepartures(seg, idx){
  const stationKey = seg + ':' + idx;
  return Promise.all([loadLiveData(), loadLiveTrainsRaw()]).then(([data, trainsIndex]) => {
    const entry = data.stations[stationKey];
    if(!entry || !entry.departures.length) return [];
    return entry.departures.map(d => {
      const {status, delay} = mapStatus(d);
      const matchedTrain = trainsIndex.get(stationKey + '|' + d.scheduled);
      const runningText = runningPositionText(matchedTrain);
      return {
        code: d.code,
        dest: d.dest,
        dir: d.dir,
        scheduled: new Date(d.scheduled),
        status, delay,
        position: runningText ? {text: runningText, unknown: false} : platformPosition(d.platform),
        platform: d.platform || null,
      };
    });
  });
}
