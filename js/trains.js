/*
* trains.js — Trains "en circulation" : marqueurs animÃ©s sur le schÃ©ma,
* suivi ("Suivre ce train en direct"), fiche train, surlignage du trajet.
*
* DÃ©pend de : data.js (ROUTES, TRAIN_DEFS, SOUTH_TERMINI, SPEED_SCALE, SEG),
* mock-schedule.js ou real-schedule.js (pick, IS_LIVE),
* panel.js (sheet, sheetList, scrollElIntoView, showRouteHighlight, etc.)
*
* Suivi des trains rÃ©els (actif quand IS_LIVE === true) :
* - liveTrains est mis Ã  jour pÃ©riodiquement Ã  partir de data/live-trains.json
*   (voir refreshLiveTrains), au lieu d'Ãªtre gÃ©nÃ©rÃ© une fois pour toutes
*   depuis TRAIN_DEFS.
* - Chaque train rÃ©el est identifiÃ© de faÃ§on unique et stable par son
*   journeyRef (FramedVehicleJourneyRef.DatedVehicleJourneyRef, exposÃ© par
*   l'API PRIM). liveTrainsById est dÃ©sormais indexÃ© par journeyRef, plus
*   par code mission.
* - La route (R1..R6) est dÃ©jÃ¡ attachÃ©e cÃ´tÃ© backend (t.route) : plus
*   besoin de resolveRoute() cÃ´tÃ© client.
* - La position est interpolÃ©e entre t.from et t.to via t.progress (dÃ©jÃ¡
*   calculÃ© cÃ´tÃ© backend dans build_live_trains.py).
*/
const trainsLayer = document.getElementById('trains-layer');
const NS = 'http://www.w3.org/2000/svg';

function southDir(name){
  return SOUTH_TERMINI.includes(name) ? 'B' : 'A';
}

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
    waypoints: null,
    el: null
  };
});

if (!IS_LIVE) {
  liveTrains.forEach(t => {
    if (t.status === 'late') t.delay = 2 + Math.floor(Math.random() * 8);
    if (t.status === 'verylate') t.delay = 10 + Math.floor(Math.random() * 16);
  });
}

const liveTrainsById = {};

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

  const seenJrefs = new Set();

  (payload.trains || []).forEach(rt => {
    const jref = rt.journeyRef || (rt.code + '|' + ((rt.from || rt.to || {}).scheduled));
    seenJrefs.add(jref);

    let ci = null;
    if (rt.progress !== null && rt.progress !== undefined && rt.route) {
      const fromCi = rt.from ? resolveStationCi(rt.from.station, rt.route) : null;
      const toCi = rt.to ? resolveStationCi(rt.to.station, rt.route) : null;
      if (fromCi !== null && toCi !== null) {
        ci = fromCi + (toCi - fromCi) * rt.progress;
      } else if (fromCi !== null) {
        ci = fromCi;
      } else if (toCi !== null) {
        ci = toCi;
      }
    }

    const status = rt.cancelled ? 'cancelled' : (rt.delay >= 10 ? 'verylate' : (rt.delay >= 2 ? 'late' : 'ontime'));

    let t = liveTrainsById[jref];
    if (!t) {
      t = {
        id: jref,
        journeyRef: jref,
        code: rt.code,
        trainNumber: rt.trainNumber,
        route: rt.route,
        points: rt.route ? ROUTES[rt.route].points : [],
        milestones: rt.route ? ROUTES[rt.route].milestones : {},
        termini: rt.route ? ROUTES[rt.route].termini : [null, null],
        ci: ci !== null ? ci : 0,
        dir: rt.dir === 'A' ? -1 : 1,
        speed: 0,
        length: 'long',
        cars: 8,
        status: status,
        delay: rt.delay || 0,
        dest: rt.dest,
        cancelled: !!rt.cancelled,
        waypoints: (rt.stops || []).map(s => ({
          ci: resolveStationCi(s.station, rt.route),
          time: new Date(s.expected).getTime()
        })).filter(w => Number.isFinite(w.ci) && Number.isFinite(w.time)),
        el: null
      };
      liveTrainsById[jref] = t;
      liveTrains.push(t);
    } else {
      t.code = rt.code;
      t.trainNumber = rt.trainNumber;
      t.route = rt.route;
      t.points = rt.route ? ROUTES[rt.route].points : [];
      t.milestones = rt.route ? ROUTES[rt.route].milestones : {};
      t.termini = rt.route ? ROUTES[rt.route].termini : [null, null];
      if (ci !== null) t.ci = ci;
      t.dir = rt.dir === 'A' ? -1 : 1;
      t.dest = rt.dest;
      t.cancelled = !!rt.cancelled;
      t.delay = rt.delay || 0;
      t.status = status;
      t.waypoints = (rt.stops || []).map(s => ({
        ci: resolveStationCi(s.station, rt.route),
        time: new Date(s.expected).getTime()
      })).filter(w => Number.isFinite(w.ci) && Number.isFinite(w.time));
    }
  });

  for (let i = liveTrains.length - 1; i >= 0; i--) {
    const t = liveTrains[i];
    if (!seenJrefs.has(t.id)) {
      if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
      if (typeof selectedTrain !== 'undefined' && selectedTrain === t && typeof closeSheet === 'function') {
        closeSheet();
      }
      delete liveTrainsById[t.id];
      liveTrains.splice(i, 1);
    }
  }
}

if (IS_LIVE) {
  refreshLiveTrains();
  setInterval(refreshLiveTrains, 15000);
}

function resolveStationCi(stationKey, routeKey) {
  if (!stationKey || !routeKey) return null;
  const name = stationKeyToName(stationKey);
  if (!name) return null;
  const ms = ROUTES[routeKey].milestones;
  const normed = normName(name);
  for (const idxStr of Object.keys(ms)) {
    if (normName(ms[idxStr]) === normed) return Number(idxStr);
  }
  return null;
}

function stationKeyToName(stationKey) {
  if (!stationKey) return null;
  const sepIdx = stationKey.lastIndexOf(':');
  if (sepIdx === -1) return null;
  const seg = stationKey.slice(0, sepIdx);
  const idx = Number(stationKey.slice(sepIdx + 1));
  const arr = SEG[seg];
  return (arr && arr[idx]) || null;
}

function normName(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
  if (below !== null) return 'AprÃ¨s ' + t.milestones[below];
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
  const statusLabel = t.cancelled ? 'supprimÃ©' : (t.status === 'ontime' ? "Ã¢ l'heure" : ('+ ' + t.delay + ' min de retard'));
  const formationLabel = t.length === 'long' ? 'Train long' : 'Train court';
  const formationIcon = t.length === 'long' ? 'ðŁŁŁðŁŁŁ' : 'ðŁŁŁ';
  sheetEyebrow.textContent = IS_LIVE ? 'Train en circulation (temps rÃ©el PRIM)' : 'Train en circulation (simulation)';
  sheetTitle.textContent = t.code;
  sheetUpdated.textContent = dirText + ' â€" ' + origin + ' â†' + dest;
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
        <span class="train-info-chip formation-${t.length}">${formationIcon} ${formationLabel} â€" ${t.cars} voitures</span>
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
  sheetUpdated.textContent = dirText + ' â€" ' + currentOrigin(t) + ' â†' + dest;
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

let lastTs = null;
function animate(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.1);
  lastTs = ts;

  liveTrains.forEach(t => {
    const n = t.points.length;

    if (IS_LIVE && t.waypoints && t.waypoints.length > 0) {
      const ci = ciFromWaypoints(t.waypoints, Date.now());
      if (ci !== null) t.ci = ci;
    } else {
      t.ci += t.dir * t.speed * dt * SPEED_SCALE;
      if (t.ci >= n - 1) {
        t.ci = n - 1; t.dir = -1;
        t.status = pick(['ontime', 'ontime', 'ontime', 'late', 'verylate']);
        t.delay = t.status === 'late' ? 2 + Math.floor(Math.random() * 8)
          : (t.status === 'verylate' ? 10 + Math.floor(Math.random() * 16) : 0);
      } else if (t.ci <= 0) {
        t.ci = 0; t.dir = 1;
        t.status = pick(['ontime', 'ontime', 'ontime', 'late', 'verylate']);
        t.delay = t.status === 'late' ? 2 + Math.floor(Math.random() * 8)
          : (t.status === 'verylate' ? 10 + Math.floor(Math.random() * 16) : 0);
      }
    }

    const [x, y] = pointAt(t, t.ci);
    if (!t.el) t.el = createTrainMarker(t);
    t.el.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
    const dirLabel = southDir(currentDestination(t));
    t.el.classList.remove('dirA', 'dirB');
    t.el.classList.add('dir' + dirLabel);
    t.el.classList.toggle('cancelled', !!t.cancelled);
    if (followActive && selectedTrain === t) t.el.classList.add('following');
    if (sheetMode === 'train' && selectedTrain === t) refreshTrainSheetLive(t);
    if (selectedTrain === t && routeHighlight.classList.contains('visible')) {
      routeHighlight.classList.remove('dirA', 'dirB');
      routeHighlight.classList.add('dir' + dirLabel);
    }
    if (followActive && selectedTrain) scrollElIntoView(selectedTrain.el, false);
  });

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

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