# Guide d'integration des donnees reelles PRIM dans rer-c PROTO VALIDE.html

## 1. Ajouter les imports en haut du script principal

Dans la balise `<script>` du fichier HTML, ajouter en tout debut (le script doit etre `type="module"` pour que `import` fonctionne) :

```js
import STATION_MAPPING from './station-mapping.js';
import { fetchRealDepartures } from './departures-adapter.js';

// Cle API PRIM : a saisir par l'utilisateur ou stocker en localStorage, jamais en dur dans le code
let PRIM_API_KEY = localStorage.getItem('prim_api_key') || '';
if (!PRIM_API_KEY) {
  PRIM_API_KEY = prompt('Cle API PRIM (laisser vide pour rester en mode simulation) :') || '';
  if (PRIM_API_KEY) localStorage.setItem('prim_api_key', PRIM_API_KEY);
}
```

Si la balise `<script>` n'est pas encore `type="module"`, l'ajouter :
```html
<script type="module">
```

## 2. Rendre renderSheet() asynchrone et brancher les vraies donnees

Chercher la fonction `renderSheet(seg, idx, name)` (elle appelle actuellement `buildDepartures(seg, idx)`). La remplacer par :

```js
async function renderSheet(seg, idx, name) {
  activeFilter = null;
  document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));

  const stationInfo = STATION_MAPPING[name];

  if (PRIM_API_KEY && stationInfo) {
    try {
      currentTrains = await fetchRealDepartures(stationInfo.monitoringRef, PRIM_API_KEY);
      sheetEyebrow.textContent = 'Prochains departs (donnees reelles PRIM)';
    } catch (e) {
      console.error('Erreur API PRIM, fallback simulation :', e);
      currentTrains = buildDepartures(seg, idx);
      sheetEyebrow.textContent = 'Prochains departs (simulation - API indisponible)';
    }
  } else {
    currentTrains = buildDepartures(seg, idx);
    sheetEyebrow.textContent = 'Prochains departs (simulation)';
  }

  renderList();
  sheetTitle.textContent = name;
  sheetUpdated.textContent = 'Actualise ' + fmtTime(new Date());
}
```

## 3. Repercuter l'async sur l'appelant

Chercher la fonction `openSheetForEl(el)` (declenchee au clic sur une gare). Elle appelle `renderSheet(seg, idx, name)` - il suffit d'ajouter `await` devant et de rendre la fonction englobante `async` si elle ne l'est pas deja :

```js
async function openSheetForEl(el) {
  // ... code existant inchange avant l'appel ...
  await renderSheet(seg, idx, name);
  // ... code existant inchange apres (sheet.classList.add('open') etc.) ...
}
```

Et dans l'event listener qui appelle `openSheetForEl` :
```js
el.addEventListener('click', () => openSheetForEl(el));
```
(la fonction fleche n'a pas besoin d'etre async elle-meme, `openSheetForEl` gere son propre await interne)

## Fallback automatique

Avec ce code, le prototype :
- Utilise les vraies donnees PRIM si une cle API est fournie et si l'appel reussit
- Retombe automatiquement sur la simulation (comportement actuel) si pas de cle, ou si l'API echoue/quota depasse

## Prochaine etape (position des trains en temps reel)

Ce guide couvre uniquement les departs (etape 1). La position reelle des trains (etape 2, via GTFS-RT) necessite un travail separe de projection GPS vers les coordonnees SVG du trace.
