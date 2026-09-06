// zoom-view.js
// Zoom + centrage sur clic gare / train, avec bouton de retour a la vue d'ensemble.
// Le panneau déclenche le cadrage une fois la sélection et sa fiche ouvertes.
(function () {
  var svg = document.querySelector('.card > svg');
  var card = document.querySelector('.card');
  if (!svg || !card) return;

  var BASE = { x: 0, y: 0, w: 620, h: 2000 };
  var current = { x: BASE.x, y: BASE.y, w: BASE.w, h: BASE.h };
  var raf = null;
  var focused = null;

  function setViewBox(vb) {
    svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function animateTo(target, duration) {
    duration = duration || 420;
    var start = { x: current.x, y: current.y, w: current.w, h: current.h };
    var t0 = null;
    if (raf) cancelAnimationFrame(raf);

    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / duration);
      var ease = 1 - Math.pow(1 - p, 3);
      current = {
        x: start.x + (target.x - start.x) * ease,
        y: start.y + (target.y - start.y) * ease,
        w: start.w + (target.w - start.w) * ease,
        h: start.h + (target.h - start.h) * ease
      };
      setViewBox(current);
      if (focused) scrollElIntoView(focused, false);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        raf = null;
      }
    }
    raf = requestAnimationFrame(step);
  }

  function zoomOn(cx, cy) {
    // Conserver le ratio pour ne pas modifier la hauteur de la page à chaque image.
    var w = 300, h = w * BASE.h / BASE.w;
    var x = clamp(cx - w / 2, BASE.x, BASE.x + BASE.w - w);
    var y = clamp(cy - h / 2, BASE.y, BASE.y + BASE.h - h);
    animateTo({ x: x, y: y, w: w, h: h });
  }

  function resetView() {
    focused = null;
    closeSheet();
    animateTo({ x: BASE.x, y: BASE.y, w: BASE.w, h: BASE.h });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  var resetBtn = document.createElement('button');
  resetBtn.id = 'zoom-reset-btn';
  resetBtn.type = 'button';
  resetBtn.textContent = 'Vue d\'ensemble';
  resetBtn.setAttribute('aria-label', "Revenir a la vue d'ensemble de la ligne");
  resetBtn.style.cssText = [
    'margin-left:auto', 'flex-shrink:0',
    'display:block', 'padding:8px 10px', 'border-radius:999px',
    'border:1px solid #d8d5cc', 'background:#ffffff', 'color:#20242b',
    'font-family:Inter, Helvetica Neue, Arial, sans-serif', 'font-size:13px',
    'font-weight:600', 'box-shadow:0 2px 8px rgba(0,0,0,0.12)', 'cursor:pointer'
  ].join(';');
  document.querySelector('header').appendChild(resetBtn);
  resetBtn.addEventListener('click', resetView);


  window.focusMapElement = function (el) {
    focused = el;
    var main = el.querySelector('circle.main');
    if (main) zoomOn(Number(main.getAttribute('cx')), Number(main.getAttribute('cy')));
    else {
      var matrix = el.transform.baseVal.consolidate();
      if (matrix) zoomOn(matrix.matrix.e, matrix.matrix.f);
    }
  };
  window.cancelMapFocus = function () {
    focused = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  };
  window.followMapTrain = function (t) {
    if (raf) return;
    var point = pointAt(t, t.ci);
    current.x = clamp(point[0] - current.w / 2, BASE.x, BASE.w - current.w);
    current.y = clamp(point[1] - current.h / 2, BASE.y, BASE.h - current.h);
    setViewBox(current);
  };
  // Une fiche peut grandir après le chargement des départs ou une rotation d'écran.
  new ResizeObserver(function () {
    if (focused && sheet.classList.contains('open')) {
      updateScrollSpacer();
      scrollElIntoView(focused, false);
    }
  }).observe(sheet);
})();
