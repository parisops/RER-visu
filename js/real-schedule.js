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
 * Dépend de : data.js (SEG), stations-idfm.js (pour le nom de repli des gares)
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
// IMPORTANT : le rattachement se fait par (gare, horaire programmé), PAS par
// le seul code mission ("code"). Un même code à 4 lettres est réutilisé par
// PLUSIEURS trains différents au même moment sur toute la ligne (voir
// tools/build_live_trains.py) — matcher uniquement sur le code aurait pour
// effet de faire pointer plusieurs gares différentes vers le MÊME train
// (bug observé : tous les départs partageant un code se retrouvaient avec
// la position du premier train trouvé pour ce code, quelle que soit la
// gare réelle). (station, scheduled) est la clé de dédoublonnage exacte déjà
// utilisée côté backend (merge_stops), donc sans ambiguïté ici.
const LIVE_TRAINS_URL = 'data/live-trains.json';
let liveTrainsIndexPromise = null;

function stationKeyToName(stationKey){
  if(!stationKey) return null;
  const sepIdx = stationKey.lastIndexOf(':');
  if(sepIdx === -1) return null;
  const seg = stationKey.slice(0, sepIdx);
  const idx = Number(stationKey.slice(sepIdx + 1));
  const arr = SEG[seg];
  return (arr && arr[idx]) || null;
}

function loadLiveTrainsIndex(){
  if(!liveTrainsIndexPromise){
    liveTrainsIndexPromise = fetch(LIVE_TRAINS_URL, {cache: 'no-store'})
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
        liveTrainsIndexPromise = null; // permet de réessayer au prochain appel
        console.warn('live-trains.json indisponible pour le calcul de position :', err);
        return new Map(); // non bloquant : repli sur la position de quai
      });
  }
  return liveTrainsIndexPromise;
}

// Construit un texte de position "en circulation" à partir d'un train résolu
// (data/live-trains.json), ou null si non exploitable (repli sur le quai).
function runningPositionText(train){
  if(!train) return null;
  if(train.cancelled) return null; // pas de position pertinente pour un train supprimé
  const fromName = train.from ? stationKeyToName(train.from.station) : null;
  const toName = train.to ? stationKeyToName(train.to.station) : null;
  if(train.state === 'enRoute' && fromName && toName) return 'Entre ' + fromName + ' et ' + toName;
  if(train.state === 'arrived' && fromName) return 'En gare de ' + fromName;
  if(train.state === 'notStarted' && toName) return 'Pas encore parti (vers ' + toName + ')';
  return null;
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
  return Promise.all([loadLiveData(), loadLiveTrainsIndex()]).then(([data, trainsIndex]) => {
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
