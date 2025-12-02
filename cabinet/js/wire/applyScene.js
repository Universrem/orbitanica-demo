// /cabinet/js/wire/applyScene.js
// Реєстр застосовувачів сцен (appliers). Без режимної логіки всередині.
// Дозволяє автоматично ВІДТВОРИТИ сцену за query: { mode, ... }.

(function exposeApplierRegistry() {
  'use strict';

  const orbit = (window.orbit = window.orbit || {});

  const appliers = Object.create(null);

  function registerSceneApplier(mode, fn) {
    if (typeof mode === 'string' && typeof fn === 'function') {
      appliers[mode] = fn;
    }
  }

  function getSceneApplier(mode) {
    return appliers[mode] || null;
  }

  async function applyScene(query) {
    try {
      if (!query || typeof query !== 'object') {
        throw new Error('applyScene: empty query');
      }
      const mode = String(query.mode || '');
      const applier = getSceneApplier(mode);
      if (!applier) {
        throw new Error(`No applier for mode "${mode}"`);
      }

      // Запуск будь-якої сцени скасовує гід першого заходу (центр → Львів за замовчуванням)
      try {
        window.dispatchEvent(new Event('orbit:centerGuide-dismiss'));
      } catch {
        // мовчки ігноруємо, якщо window недоступне / подія нецікава
      }

      // Якщо мітки ще нема — ставимо дефолтну (Львів); якщо вже є — нічого не чіпаємо
      try {
        const { markerLayer, defaultCenterLon, defaultCenterLat } = await import('/js/globe/globe.js');
        const { placeMarker } = await import('/js/globe/markers.js');

        const ents = markerLayer.getEntities?.() || [];
        if (!ents.length) {
          placeMarker(defaultCenterLon, defaultCenterLat, { silent: true, suppressEvent: true });
        }
      } catch (e) {
        console.warn('[applyScene] center marker skipped:', e);
      }

      await applier(query); // може бути sync/async
      return true;
    } catch (e) {
      console.error('[applyScene] failed:', e);
      return false;
    }
  }

  // Публічне API
  orbit.registerSceneApplier = registerSceneApplier;
  orbit.getSceneApplier = getSceneApplier;
  orbit.applyScene = applyScene;

  // Якщо якісь аплаєри приїхали раніше — зареєструємо їх зараз
  if (Array.isArray(window.__orbit_pending_appliers__)) {
    for (const a of window.__orbit_pending_appliers__) {
      if (a && typeof a.mode === 'string' && typeof a.fn === 'function') {
        registerSceneApplier(a.mode, a.fn);
      }
    }
    window.__orbit_pending_appliers__ = [];
  }
})();
