// zoom-view.js
// Zoom + centrage sur clic gare / train, avec bouton de retour a la vue d'ensemble.
// Ajout pur : n'intercepte ni ne modifie les listeners existants (panel.js, trains.js).
(function () {
  var svg = document.querySelector('.card > svg');
  var card = document.querySelector('.card');
  if (!svg || !card) return;

  var BASE = { x: 0, y: 0, w: 620, h: 2000 };
  var current = { x: BASE.x, y: BASE.y, w: BASE.w, h: BASE.h };
  var raf = null;

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
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        raf = null;
      }
    }
    raf = requestAnimationFrame(step);
  }

  function zoomOn(cx, cy) {
    var w = 260, h = 420; // fenetre zoomee (ratio proche du schema)
    var x = clamp(cx - w / 2, BASE.x, BASE.x + BASE.w - w);
    var y = clamp(cy - h / 2, BASE.y, BASE.y + BASE.h - h);
    animateTo({ x: x, y: y, w: w, h: h });
    setResetVisible(true);
  }

  function resetView() {
    animateTo({ x: BASE.x, y: BASE.y, w: BASE.w, h: BASE.h });
    setResetVisible(false);
  }

  var resetBtn = document.createElement('button');
  resetBtn.id = 'zoom-reset-btn';
  resetBtn.type = 'button';
  resetBtn.textContent = 'Vue d\'ensemble';
  resetBtn.setAttribute('aria-label', "Revenir a la vue d'ensemble de la ligne");
  resetBtn.style.cssText = [
    'position:absolute', 'top:12px', 'right:12px', 'z-index:20',
    'display:none', 'padding:8px 14px', 'border-radius:999px',
    'border:1px solid #d8d5cc', 'background:#ffffff', 'color:#20242b',
    'font-family:Inter, Helvetica Neue, Arial, sans-serif', 'font-size:13px',
    'font-weight:600', 'box-shadow:0 2px 8px rgba(0,0,0,0.12)', 'cursor:pointer'
  ].join(';');
  if (getComputedStyle(card).position === 'static') {
    card.style.position = 'relative';
  }
  card.appendChild(resetBtn);
  resetBtn.addEventListener('click', resetView);

  function setResetVisible(show) {
    resetBtn.style.display = show ? 'block' : 'none';
  }

  // Capture phase : se declenche avant les listeners existants sur .stop / .train-marker,
  // sans jamais appeler stopPropagation, donc le panneau (sheet) continue de s'ouvrir normalement.
  svg.addEventListener('click', function (e) {
    var stopEl = e.target.closest ? e.target.closest('.stop') : null;
    if (stopEl) {
      var main = stopEl.querySelector('circle.main');
      if (main) {
        zoomOn(parseFloat(main.getAttribute('cx')), parseFloat(main.getAttribute('cy')));
      }
      return;
    }
    var trainEl = e.target.closest ? e.target.closest('.train-marker') : null;
    if (trainEl) {
      var tf = trainEl.getAttribute('transform') || '';
      var m = tf.match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/);
      if (m) {
        zoomOn(parseFloat(m[1]), parseFloat(m[2]));
      }
    }
  }, true);
})();
