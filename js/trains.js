/*
 * trains.js — Trains "en circulation" : marqueurs animés sur le schéma,
 * suivi ("Suivre ce train en direct"), fiche train, surlignage du trajet.
 *
 * Dépend de : data.js (ROUTES, TRAIN_DEFS, SOUTH_TERMINI, SPEED_SCALE, SEG),
 *   mock-schedule.js ou real-schedule.js (pick, IS_LIVE),
 *   panel.js (sheet, sheetList, scrollElIntoView, showRouteHighlight, etc.)
 *
 * Suivi des trains réels (actif quand IS_LIVE === true, positionné par
 * real-schedule.js) :
 * - liveTrains est mis à jour périodiquement à partir de data/live-trains.json
 *   (voir refreshLiveTrains), au lieu d'être généré une fois pour toutes
 *   depuis TRAIN_DEFS.
 * - Chaque train réel est rattaché à la route ROUTES[Rx] qui correspond
 *   effectivement à sa mission (cf. resolveRoute) : il suit donc TOUJOURS le
 *   tracé réel de la ligne (jamais de trajectoire à vol d'oiseau).
 * - t.waypoints contient TOUS les arrêts connus de la mission (pas
 *   seulement le prochain), chacun avec sa position sur le tracé (ci) et son
 *   heure attendue (time, epoch ms). animate() recalcule à CHAQUE FRAME, via
 *   Date.now(), entre quels deux waypoints consécutifs on se trouve et
 *   interpole entre les deux — le train traverse donc en continu tous les
 *   tronçons connus, pas seulement le premier, même si le backend PRIM ne
 *   tourne que toutes les 5-15 min. Au-delà du dernier waypoint connu, il
 *   reste sur ce point (en attente de données plus fraîches) plutôt que de
 *   disparaître ou dévier du tracé.
 * - Chaque rafraîchissement de data/live-trains.json (15 s) recalcule les
 *   waypoints à partir des données les plus récentes : si un retard a changé
 *   ou que de nouveaux arrêts futurs sont connus, la trajectoire se corrige
 *   pour les prochaines frames sans téléportation brutale (sauf incohérence
 *   majeure, ex. arrêt manqué entre deux refresh).
 */

const trainsLayer = document.getElementById('trains-layer');
const NS = 'http://www.w3.org/2000/svg';

function southDir(name){ return SOUTH_TERMINI.includes(name) ? 'B' : 'A'; }

// --- Construction initiale de liveTrains ------------------------------------

const liveTrains = IS_LIVE ? [] : TRAIN_DEFS.map((def, i) => {
  const route = ROUTES[def.route];
  const n = route.points.length;
  return {
    id: i,
    code: def.code,
    route: def.route,
    points: route.points,
    milestones: route.milestones,
    termini: route.termini,
    ci: def.startFrac * (n - 1),
    dir: def.dir,
    speed: def.speed,
    length: def.length,
    cars: def.cars,
    status: pick(['ontime', 'ontime', 'ontime', 'late', 'verylate']),
    delay: 0,
    dest: null,
    cancelled: false,
    waypoints: null, // mode live uniquement
    el: null
  };
});

if (!IS_LIVE) {
  liveTrains.forEach(t => {
    if (t.status === 'late') t.delay = 2 + Math.floor(Math.random() * 8);
    if (t.status === 'verylate') t.delay = 10 + Math.floor(Math.random() * 16);
  });
}

// --- Suivi des trains réels : résolution de la route à partir des gares connues --

// Normalise un nom de gare pour une comparaison robuste (accents, casse, ponctuation).
function normName(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Table nom-normalisé -> index le long du tracé, mise en cache par route.
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

// Résout une clé de gare "seg:idx" (format PRIM / live-trains.json, identique
// à stations-idfm.js) en nom de gare réel, via SEG (data.js).
function stationKeyToName(stationKey) {
  if (!stationKey) return null;
  const sepIdx = stationKey.lastIndexOf(':');
  if (sepIdx === -1) return null;
  const seg = stationKey.slice(0, sepIdx);
  const idx = Number(stationKey.slice(sepIdx + 1));
  const arr = SEG[seg];
  return (arr && arr[idx]) || null;
}

// Trouve, parmi ROUTES (R1..R6), celle qui contient TOUTES les gares connues
// du train (mission.stops) dans le bon ordre. Retourne {routeKey, indices}
// (indices aligné terme à terme avec stops) ou null si aucune route ne
// correspond — le train est alors ignoré plutôt que dessiné hors tracé.
function resolveRoute(stops) {
  const names = stops.map(s => stationKeyToName(s.station)).filter(Boolean);
  if (names.length === 0) return null;
  const normed = names.map(normName);

  let best = null;
  for (const routeKey of Object.keys(ROUTES)) {
    const nameIndex = routeNameIndex(routeKey);
    const indices = normed.map(n => nameIndex[n]);
    if (indices.some(ix => ix === undefined)) continue; // gare absente de cette route

    let increasing = true, decreasing = true;
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] <= indices[i - 1]) increasing = false;
      if (indices[i] >= indices[i - 1]) decreasing = false;
    }
    if (!increasing && !decreasing) continue; // ordre incohérent : pas la bonne route

    if (!best || indices.length > best.indices.length) {
      best = { routeKey, indices };
    }
  }
  return best;
}

// --- Rafraîchissement périodique depuis data/live-trains.json ---------------

const liveTrainsById = {}; // code mission -> objet train (mise à jour en place)

async function refreshLiveTrains() {
  if (!IS_LIVE) return;
  let payload;
  try {
    const res = await fetch('data/live-trains.json', { cache: 'no-store' });
    payload = await res.json();
  } catch (e) {
    console.warn('live-trains.json indisponible :', e);
    return;
  }

  const seenCodes = new Set();

  (payload.trains || []).forEach(rt => {
    const stops = rt.stops || [];
    const resolved = resolveRoute(stops);
    if (!resolved) return; // impossible de rattacher ce train à une route connue : on l'ignore

    const route = ROUTES[resolved.routeKey];
    // Construit la liste complète des points d'ancrage (ci, heure attendue)
    // à partir de TOUS les arrêts connus de la mission, pas seulement from/to.
    const waypoints = stops
      .map((s, i) => ({ ci: resolved.indices[i], time: new Date(s.expected).getTime() }))
      .filter(w => Number.isFinite(w.ci) && Number.isFinite(w.time))
      .sort((a, b) => a.time - b.time);

    if (waypoints.length === 0) return;

    const firstCi = waypoints[0].ci;
    const lastCi = waypoints[waypoints.length - 1].ci;
    const dir = lastCi < firstCi ? -1 : 1;

    const status = rt.cancelled ? 'cancelled' : (rt.delay >= 10 ? 'verylate' : (rt.delay >= 2 ? 'late' : 'ontime'));

    seenCodes.add(rt.code);

    let t = liveTrainsById[rt.code];
    if (!t) {
      t = {
        id: rt.code,
        code: rt.code,
        route: resolved.routeKey,
        points: route.points,
        milestones: route.milestones,
        termini: route.termini,
        ci: waypoints[0].ci,
        dir: dir,
        speed: 0,
        length: 'long',
        cars: 8,
        status: status,
        delay: rt.delay || 0,
        dest: rt.dest,
        cancelled: !!rt.cancelled,
        waypoints: waypoints,
        el: null
      };
      liveTrainsById[rt.code] = t;
      liveTrains.push(t);
    } else {
      t.route = resolved.routeKey;
      t.points = route.points;
      t.milestones = route.milestones;
      t.termini = route.termini;
      t.dir = dir;
      t.dest = rt.dest;
      t.cancelled = !!rt.cancelled;
      t.delay = rt.delay || 0;
      t.status = status;
      t.waypoints = waypoints;
    }
  });

  // Retire les trains qui ne sont plus dans le flux PRIM (arrivés, disparus).
  for (let i = liveTrains.length - 1; i >= 0; i--) {
    const t = liveTrains[i];
    if (!seenCodes.has(t.code)) {
      if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
      if (typeof selectedTrain !== 'undefined' && selectedTrain === t && typeof closeSheet === 'function') {
        closeSheet();
      }
      delete liveTrainsById[t.code];
      liveTrains.splice(i, 1);
    }
  }
}

if (IS_LIVE) {
  refreshLiveTrains();
  setInterval(refreshLiveTrains, 15000); // 15 s : recale les waypoints, ne fait pas avancer la position elle-même (voir animate)
}

// Trouve la position (ci) correspondant à l'heure "now" en interpolant entre
// les deux waypoints consécutifs qui l'encadrent. Reste sur le premier/dernier
// point connu si "now" est hors de la plage couverte par les waypoints.
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

// --- Rendu du marqueur SVG (inchangé) ---------------------------------------

function createTrainMarker(t) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'train-marker dir' + southDir(currentDestination(t)));
  g.setAttribute('tabindex', '0');
  g.setAttribute('role', 'button');

  const pulse = document.createElementNS(NS, 'circle');
  pulse.setAttribute('class', 'train-pulse');
  pulse.setAttribute('r', '10');
  g.appendChild(pulse);

  const body = document.createElementNS(NS, 'path');
  body.setAttribute('class', 'train-body');
  body.setAttribute('d', 'M -8 5.5 L -8 -3 Q -8 -10 0 -10 Q 8 -10 8 -3 L 8 5.5 Q 8 9.5 4.5 9.5 L -4.5 9.5 Q -8 9.5 -8 5.5 Z');
  body.setAttribute('stroke', '#ffffff');
  body.setAttribute('stroke-width', '1.5');
  g.appendChild(body);

  const roofline = document.createElementNS(NS, 'path');
  roofline.setAttribute('class', 'train-roofline');
  roofline.setAttribute('d', 'M -6 -7.5 Q 0 -9.2 6 -7.5');
  g.appendChild(roofline);

  const windshield = document.createElementNS(NS, 'path');
  windshield.setAttribute('class', 'train-windshield');
  windshield.setAttribute('d', 'M -5.6 -5.8 Q 0 -8 5.6 -5.8 Q 5.6 -1.8 0 -0.6 Q -5.6 -1.8 -5.6 -5.8 Z');
  g.appendChild(windshield);

  const lightL = document.createElementNS(NS, 'circle');
  lightL.setAttribute('class', 'train-light');
  lightL.setAttribute('cx', '-4.4');
  lightL.setAttribute('cy', '4.6');
  lightL.setAttribute('r', '1.5');
  g.appendChild(lightL);

  const lightR = document.createElementNS(NS, 'circle');
  lightR.setAttribute('class', 'train-light');
  lightR.setAttribute('cx', '4.4');
  lightR.setAttribute('cy', '4.6');
  lightR.setAttribute('r', '1.5');
  g.appendChild(lightR);

  g.addEventListener('click', (e) => { e.stopPropagation(); openTrainSheet(t); });
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openTrainSheet(t); }
  });

  trainsLayer.appendChild(g);
  return g;
}

function currentDestination(t) { return t.dir > 0 ? t.termini[1] : t.termini[0]; }
function currentOrigin(t) { return t.dir > 0 ? t.termini[0] : t.termini[1]; }

function positionText(t) {
  const keys = Object.keys(t.milestones).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) return 'Entre deux gares';
  let below = null, above = null;
  for (const k of keys) {
    if (k <= t.ci) below = k;
    if (k >= t.ci && above === null) above = k;
  }
  const EPS = 0.6;
  if (below !== null && Math.abs(t.ci - below) < EPS) return 'En gare de ' + t.milestones[below];
  if (above !== null && Math.abs(above - t.ci) < EPS) return 'En gare de ' + t.milestones[above];
  if (below !== null && above !== null && below !== above) {
    return 'Entre ' + t.milestones[below] + ' et ' + t.milestones[above];
  }
  if (below !== null) return 'Après ' + t.milestones[below];
  if (above !== null) return 'Avant ' + t.milestones[above];
  return 'Entre deux gares';
}

function pointAt(t, ci) {
  const pts = t.points, n = pts.length;
  const clamped = Math.max(0, Math.min(n - 1, ci));
  const i0 = Math.floor(clamped);
  const i1 = Math.min(n - 1, i0 + 1);
  const frac = clamped - i0;
  return [
    pts[i0][0] + (pts[i1][0] - pts[i0][0]) * frac,
    pts[i0][1] + (pts[i1][1] - pts[i0][1]) * frac
  ];
}

function renderTrainSheet(t) {
  const dest = currentDestination(t);
  const origin = currentOrigin(t);
  const dirLabel = southDir(dest);
  const dirText = dirLabel === 'B' ? 'Direction Sud' : 'Direction Nord';
  const statusLabel = t.cancelled ? 'supprimé' : (t.status === 'ontime' ? "à l'heure" : ('+ ' + t.delay + ' min de retard'));
  const formationLabel = t.length === 'long' ? 'Train long' : 'Train court';
  const formationIcon = t.length === 'long' ? '🚃🚃' : '🚃';

  sheetEyebrow.textContent = IS_LIVE ? 'Train en circulation (temps réel PRIM)' : 'Train en circulation (simulation)';
  sheetTitle.textContent = t.code;
  sheetUpdated.textContent = dirText + ' — ' + origin + ' → ' + dest;

  sheetList.innerHTML = `
    <div class="train-info-card">
      <div class="train-info-head">
        <div class="train-info-code dir${dirLabel}">${t.code}</div>
        <div>
          <div class="train-info-dest">Vers ${dest}</div>
          <div class="train-info-sub">${dirText} en provenance de ${origin}</div>
        </div>
      </div>
      <div class="train-info-meta">
        <span class="train-info-chip formation-${t.length}">${formationIcon} ${formationLabel} — ${t.cars} voitures</span>
      </div>
      <div class="train-info-pos"><span id="train-info-pos-text">${positionText(t)}</span></div>
      <div class="train-info-status ${t.status}" id="train-info-status">${statusLabel}</div>
    </div>
  `;
}

function refreshTrainSheetLive(t) {
  if (sheetMode !== 'train' || selectedTrain !== t) return;
  const posEl = document.getElementById('train-info-pos-text');
  if (posEl) posEl.textContent = positionText(t);
  const dest = currentDestination(t);
  const dirLabel = southDir(dest);
  const dirText = dirLabel === 'B' ? 'Direction Sud' : 'Direction Nord';
  sheetUpdated.textContent = dirText + ' — ' + currentOrigin(t) + ' → ' + dest;
}

function openTrainSheet(t) {
  if (selectedEl) { selectedEl.classList.remove('selected'); selectedEl = null; }
  if (sheetMode === 'train' && selectedTrain === t && sheet.classList.contains('open')) { closeSheet(); return; }
  stopFollowing();
  selectedTrain = t;
  sheetMode = 'train';
  sheetFilters.style.display = 'none';
  sheetTrainControls.style.display = 'block';
  renderTrainSheet(t);
  showRouteHighlight(t);
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  updateScrollSpacer();
}

function activateFollowing() {
  followActive = true;
  followBtn.classList.add('active');
  followBtn.querySelector('.follow-label').textContent = 'Suivi en direct actif';
  if (selectedTrain && selectedTrain.el) selectedTrain.el.classList.add('following');
  if (selectedTrain && selectedTrain.el) scrollElIntoView(selectedTrain.el, true);
}

followBtn.addEventListener('click', () => {
  if (!selectedTrain) return;
  if (followActive) stopFollowing();
  else activateFollowing();
});

// --- Boucle d'animation -------------------------------------------------------

let lastTs = null;
function animate(ts) {
  if (lastTs === null) lastTs = ts;
  const dtMs = ts - lastTs;
  lastTs = ts;
  const now = Date.now();

  liveTrains.forEach(t => {
    if (IS_LIVE) {
      if (t.waypoints && t.waypoints.length) {
        t.ci = ciFromWaypoints(t.waypoints, now);
      }
    } else {
      const n = t.points.length;
      const distPerMs = (t.speed * SPEED_SCALE) / 1000;
      t.ci += t.dir * distPerMs * dtMs;
      if (t.ci < 0) t.ci = 0;
      if (t.ci > n - 1) t.ci = n - 1;
    }

    if (!t.el) t.el = createTrainMarker(t);
    const [x, y] = pointAt(t, t.ci);
    t.el.setAttribute('transform', `translate(${x}, ${y}) rotate(${t.dir > 0 ? 90 : -90})`);
    t.el.classList.toggle('cancelled', !!t.cancelled);

    if (sheetMode === 'train' && selectedTrain === t) {
      refreshTrainSheetLive(t);
    }
  });

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
