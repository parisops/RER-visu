/*
 * panel.js — Panneau de départs (bottom sheet) : ouverture/fermeture, filtres
 * Nord/Sud, rendu de la liste, et l'animation qui recentre la gare cliquée dans
 * la zone encore visible au-dessus du panneau.
 *
 * Dépend de : data.js, mock-schedule.js (buildDepartures), et du DOM défini dans
 * index.html (#sheet, #sheet-list, .stop, .dir-btn, ...).
 * Référencé par : trains.js (openTrainSheet réutilise sheet/sheetList/scrollElIntoView, etc.)
 */

const sheet = document.getElementById('sheet');
const sheetList = document.getElementById('sheet-list');
const scrollSpacer = document.getElementById('scroll-spacer');
const sheetFilters = document.getElementById('sheet-filters');
const sheetTrainControls = document.getElementById('sheet-train-controls');
const followBtn = document.getElementById('follow-btn');
const sheetEyebrow = document.getElementById('sheet-eyebrow');
const sheetTitle = document.getElementById('sheet-station-name');
const sheetUpdated = document.getElementById('sheet-updated');
const routeHighlight = document.getElementById('route-highlight');

let selectedEl = null;
let currentTrains = [];
let activeFilter = null;
let sheetMode = null;
let selectedTrain = null;
let followActive = false;
let expectedScrollY = null;
let suppressScrollCheck = 0;

function renderList(){
  sheetList.innerHTML = '';
  const filtered = activeFilter ? currentTrains.filter(t => t.dir === activeFilter) : currentTrains;
  if(filtered.length === 0){
    sheetList.innerHTML = '<div class="dep-empty">Aucun départ simulé dans cette direction pour le moment.</div>';
    return;
  }
  filtered.forEach(t => {
    const row = document.createElement('div');
    row.className = 'dep-row' + (t.status === 'cancelled' ? ' cancelled' : '');
    const delayLabel = t.status === 'ontime' ? "à l'heure" : t.status === 'cancelled' ? 'Supprimé' : (t.delay + ' min');
    row.innerHTML = `
      <div class="dep-code dir${t.dir}">${t.code}</div>
      <div class="dep-main">
        <div class="dep-dest">${t.dest}</div>
        <div class="dep-pos ${t.position.unknown ? 'unknown' : ''}">${t.position.text}</div>
      </div>
      <div class="dep-time">
        <div class="dep-hhmm">${fmtTime(t.scheduled)}</div>
        <div class="dep-delay ${t.status}">${delayLabel}</div>
      </div>`;
    sheetList.appendChild(row);
  });
}

function setFilter(dir){
  activeFilter = (activeFilter === dir) ? null : dir;
  document.querySelectorAll('.dir-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.dir === activeFilter);
  });
  renderList();
}

function renderSheet(seg, idx, name){
  currentTrains = buildDepartures(seg, idx);
  activeFilter = null;
  document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
  renderList();
  sheetEyebrow.textContent = 'Prochains départs (simulation)';
  sheetTitle.textContent = name;
  sheetUpdated.textContent = 'Simulation actualisée à ' + fmtTime(new Date());
}

function scrollElIntoView(el, smooth){
  const headerEl = document.querySelector('header');
  const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
  const sheetH = sheet.getBoundingClientRect().height;
  const visibleH = Math.max(window.innerHeight - headerH - sheetH, 0);
  const topPadding = Math.min(Math.max(visibleH * 0.32, 56), 140);
  const rect = el.getBoundingClientRect();
  const targetY = window.scrollY + rect.top - headerH - topPadding;
  const top = Math.max(targetY, 0);
  suppressScrollCheck = 2;
  expectedScrollY = top;
  if(smooth){
    window.scrollTo({ top, behavior: 'smooth' });
  } else if(Math.abs(window.scrollY - top) > 1.5){
    window.scrollTo({ top, behavior: 'auto' });
  }
}

window.addEventListener('scroll', () => {
  if(!followActive) return;
  if(suppressScrollCheck > 0){ suppressScrollCheck--; return; }
  if(expectedScrollY !== null && Math.abs(window.scrollY - expectedScrollY) > 45){
    stopFollowing();
  }
});

function updateScrollSpacer(){
  if(sheet.classList.contains('open')){
    const sheetH = sheet.getBoundingClientRect().height;
    scrollSpacer.style.height = (sheetH + 24) + 'px';
  } else {
    scrollSpacer.style.height = '0px';
  }
}
window.addEventListener('resize', updateScrollSpacer);

function stopFollowing(){
  followActive = false;
  expectedScrollY = null;
  followBtn.classList.remove('active');
  followBtn.querySelector('.follow-label').textContent = 'Suivre ce train en direct';
  if(selectedTrain && selectedTrain.el) selectedTrain.el.classList.remove('following');
}

function hideRouteHighlight(){
  routeHighlight.classList.remove('visible');
}

function showRouteHighlight(t){
  const d = 'M ' + t.points.map(p => p[0] + ' ' + p[1]).join(' L ');
  routeHighlight.setAttribute('d', d);
  routeHighlight.classList.remove('dirA', 'dirB');
  routeHighlight.classList.add('dir' + southDir(currentDestination(t)));
  routeHighlight.classList.add('visible');
}

function openSheetFor(el){
  const seg = el.dataset.seg, idx = parseInt(el.dataset.idx, 10);
  const name = el.getAttribute('aria-label');
  if(sheetMode === 'station' && selectedEl === el && sheet.classList.contains('open')){
    closeSheet();
    return;
  }
  stopFollowing();
  selectedTrain = null;
  hideRouteHighlight();
  if(selectedEl) selectedEl.classList.remove('selected');
  selectedEl = el;
  el.classList.add('selected');
  sheetMode = 'station';
  sheetFilters.style.display = 'flex';
  sheetTrainControls.style.display = 'none';
  renderSheet(seg, idx, name);
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden','false');
  updateScrollSpacer();
  scrollElIntoView(el, true);
}

function closeSheet(){
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden','true');
  if(selectedEl) selectedEl.classList.remove('selected');
  selectedEl = null;
  sheetMode = null;
  stopFollowing();
  selectedTrain = null;
  hideRouteHighlight();
  updateScrollSpacer();
}

document.querySelectorAll('.stop').forEach(el => {
  el.addEventListener('click', () => openSheetFor(el));
  el.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openSheetFor(el); }
  });
});
document.getElementById('sheet-close').addEventListener('click', closeSheet);
document.querySelectorAll('.dir-btn').forEach(b => {
  b.addEventListener('click', () => setFilter(b.dataset.dir));
});
