/*
 * mock-schedule.js — Générateur de départs / positions SIMULÉS.
 *
 * >>> C'EST LE FICHIER À REMPLACER EN PRIORITÉ POUR BRANCHER DE VRAIES DONNÉES. <<<
 *
 * Toutes les fonctions ci-dessous fabriquent des données aléatoires mais plausibles
 * (codes mission, horaires, retards, positions). Pour connecter une vraie source
 * (API temps réel IDFM, GTFS-RT, etc.), il suffit d'écrire un fichier équivalent
 * (ex: real-schedule.js) qui expose exactement les mêmes fonctions avec la même
 * signature, chargé à la place de celui-ci dans index.html :
 *
 *   - getDirections(seg, idx)   -> {A: [destinations] | null, B: [destinations] | null}
 *   - buildDepartures(seg, idx) -> tableau de 6 objets {code, dest, dir, scheduled, status, delay, position}
 *   - randomPosition(seg, idx)  -> {text, unknown}  (position "actuellement à ..." d'un train)
 *   - pick / pad / fmtTime      -> petits utilitaires réutilisés par panel.js et trains.js
 *
 * Rien d'autre dans le code (panel.js, trains.js) n'a besoin de changer tant que
 * cette interface est respectée.
 *
 * Dépend de : data.js (SEG, TERM, CODES)
 */

function getDirections(seg, idx){
  const lastIdx = SEG[seg].length - 1;
  if(seg === 'spine'){
    if(idx <= 19){
      if(idx === 0) return {A:null, B:[TERM.massy,TERM.dourdan,TERM.etampes]};
      return {A:[TERM.pontoise], B:[TERM.massy,TERM.dourdan,TERM.etampes]};
    } else if(idx <= 30){
      return {A:[TERM.pontoise,TERM.vcrg,TERM.stquentin], B:[TERM.massy,TERM.dourdan,TERM.etampes]};
    } else {
      return {A:[TERM.pontoise,TERM.vcrg,TERM.stquentin], B:[TERM.dourdan,TERM.etampes]};
    }
  }
  if(seg === 'west'){
    if(idx <= 2){
      if(idx === 0) return {A:null, B:[TERM.pontoise,TERM.massy,TERM.dourdan,TERM.etampes]};
      return {A:[TERM.stquentin], B:[TERM.pontoise,TERM.massy,TERM.dourdan,TERM.etampes]};
    }
    return {A:[TERM.stquentin,TERM.vcrg], B:[TERM.pontoise,TERM.massy,TERM.dourdan,TERM.etampes]};
  }
  if(seg === 'spur') return {A:null, B:[TERM.pontoise,TERM.massy,TERM.dourdan,TERM.etampes]};
  if(seg === 'orly'){
    if(idx === lastIdx) return {A:[TERM.pontoise,TERM.vcrg,TERM.stquentin], B:null};
    return {A:[TERM.pontoise,TERM.vcrg,TERM.stquentin], B:[TERM.massy]};
  }
  if(seg === 'dourdan'){
    if(idx === lastIdx) return {A:[TERM.pontoise,TERM.vcrg,TERM.stquentin], B:null};
    return {A:[TERM.pontoise,TERM.vcrg,TERM.stquentin], B:[TERM.dourdan]};
  }
  if(seg === 'etampes'){
    if(idx === lastIdx) return {A:[TERM.pontoise,TERM.vcrg,TERM.stquentin], B:null};
    return {A:[TERM.pontoise,TERM.vcrg,TERM.stquentin], B:[TERM.etampes]};
  }
}

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function pad(n){ return n.toString().padStart(2,'0'); }
function fmtTime(d){ return pad(d.getHours())+':'+pad(d.getMinutes()); }

function randomPosition(seg, idx){
  const roll = Math.random();
  if(roll < 0.22) return {text:"Information non disponible", unknown:true};
  if(idx > 0 && roll < 0.62){
    const j = Math.floor(Math.random()*idx);
    return {text:"Actuellement à "+SEG[seg][j], unknown:false};
  }
  return {text: pick(["Train à l'approche","Entre deux gares","À quai"]), unknown:false};
}

function buildDepartures(seg, idx){
  const dirs = getDirections(seg, idx);
  const n = 6;
  const trains = [];
  let cursor = new Date(Date.now() + (60 + Math.random()*120) * 1000);
  const usedCodes = new Set();
  for(let i=0;i<n;i++){
    let dir;
    if(dirs.A && dirs.B) dir = Math.random() < 0.5 ? 'A' : 'B';
    else dir = dirs.A ? 'A' : 'B';
    const pool = dir === 'A' ? dirs.A : dirs.B;
    const dest = pick(pool);
    let code;
    do { code = pick(CODES); } while(usedCodes.has(code) && usedCodes.size < CODES.length);
    usedCodes.add(code);
    const roll = Math.random();
    let status, delay;
    if(roll < 0.05){ status='cancelled'; delay=0; }
    else if(roll < 0.70){ status='ontime'; delay=0; }
    else if(roll < 0.92){ status='late'; delay=2+Math.floor(Math.random()*8); }
    else { status='verylate'; delay=10+Math.floor(Math.random()*16); }
    const scheduled = new Date(cursor.getTime());
    const position = randomPosition(seg, idx);
    trains.push({code, dest, dir, scheduled, status, delay, position});
    cursor = new Date(cursor.getTime() + (5 + Math.random()*7) * 60000);
  }
  return trains;
}
