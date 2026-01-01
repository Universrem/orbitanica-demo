// /js/ui/zoomButtons.js
'use strict';

import { globus } from '../globe/globe.js';
import { getCameraAPI } from '../globe/camera.js';

function onReady(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn, { once: true });
}

function attachZoomButtons() {
  const btnIn  = document.getElementById('zoom-in');
  const btnOut = document.getElementById('zoom-out');
  const wrap   = document.getElementById('zoom-controls');

  if (!btnIn || !btnOut) return;

  const camAPI = getCameraAPI();

  const stop = (e) => {
    try { e.preventDefault(); } catch {}
    try { e.stopPropagation(); } catch {}
  };

  // поріг: якщо відпустили швидко — це "тап"
  const TAP_THRESHOLD_MS = 140;

  let active = null; // 'in' | 'out' | null
  let downAt = 0;

  const endAny = () => {
    try { camAPI.stopZoom(); } catch {}
    active = null;
    downAt = 0;
  };

  const bind = (btn, key) => {
    const start = (e) => {
      stop(e);

      // якщо вже активні — не дублювати
      if (active) return;

      active = key;
      downAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      // стартую безперервний зум одразу (без таймерів)
      try {
        if (key === 'in') camAPI.startZoomIn(globus);
        else camAPI.startZoomOut(globus);
      } catch {}
    };

    const end = (e) => {
      stop(e);

      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const dt = downAt ? (now - downAt) : 9999;

      // зупиняю безперервний зум
      endAny();

      // якщо це був "тап" — зробити один крок
      if (dt <= TAP_THRESHOLD_MS) {
        try {
          if (key === 'in') camAPI.zoomIn(globus);
          else camAPI.zoomOut(globus);
        } catch {}
      }
    };

    // Pointer
    btn.addEventListener('pointerdown', start, { passive: false });
    btn.addEventListener('pointerup', end, { passive: false });
    btn.addEventListener('pointercancel', end, { passive: false });

    // Touch fallback (важливо для мобільних)
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('touchcancel', end, { passive: false });
  };

  bind(btnIn, 'in');
  bind(btnOut, 'out');

  // Глушимо події на контейнері, щоб не запускати жести глобуса
  if (wrap) {
    wrap.addEventListener('pointerdown', stop, { passive: false });
    wrap.addEventListener('touchstart', stop, { passive: false });
    wrap.addEventListener('wheel', stop, { passive: false });
  }

  // Глобальні стопи
  window.addEventListener('blur', endAny, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) endAny();
  }, { passive: true });
}

onReady(attachZoomButtons);
