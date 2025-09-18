// Відтворення сцени «Географія → Об’єкти» БЕЗ кліку по «Старт».
// Малює О1 і ПО ЧЕРЗІ всі О2, викликаючи еталонний обробник режиму.
// Одноразовий «сторож»: на перший рух центру робимо повний reset і перемальовуємо.

import { onGeoObjectsCalculate } from '/js/events/geo_objects_buttons.js';

(function registerGeoObjectsApplier(){
  'use strict';

  const CENTER_EVS = ['orbit:center-changed','orbit:centerChanged','og:center-changed','og:centerChanged'];
  let pendingCenterOnce = null;

  function clearPendingCenterOnce() {
    if (!pendingCenterOnce) return;
    for (const ev of CENTER_EVS) window.removeEventListener(ev, pendingCenterOnce);
    pendingCenterOnce = null;
  }
  window.addEventListener('orbit:ui-reset', clearPendingCenterOnce);

  // ---- mini DOM helpers
  function setDetailsOpen(id) {
    const det = document.getElementById(id);
    if (det && 'open' in det) det.open = true;
  }
  // ставимо значення БЕЗ dispatchEvent
  function setSelectValue(id, value, label) {
    if (value == null) return;
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;
    const val = String(value);
    let has = false;
    for (const o of sel.options) if (String(o.value) === val) { has = true; break; }
    if (!has) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label != null ? String(label) : val;
      sel.appendChild(opt);
    }
    sel.value = val;
  }
  function setNumberInput(id, n) {
    if (n == null) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(n);
  }
  function collectO2s(d) {
    if (Array.isArray(d?.o2s) && d.o2s.length) return d.o2s.filter(Boolean);
    if (d?.o2) return [d.o2];
    return [];
  }

  function setupFirstCenterRepaint(query) {
    if (!query || query.__geo_objects_applier_reapplied) return;
    clearPendingCenterOnce();

    const once = async () => {
      clearPendingCenterOnce();
      try { window.dispatchEvent(new Event('orbit:ui-reset')); } catch(_) {}
      try {
        const q2 = { ...query, __geo_objects_applier_reapplied: true };
        await applyGeoObjectsScene(q2);
      } catch (e) {
        console.error('[geo_objects_applier] repaint after center change failed:', e);
      }
    };

    pendingCenterOnce = once;
    for (const ev of CENTER_EVS) window.addEventListener(ev, once, { once: true });
  }

  // ---- головний аплаєр
  async function applyGeoObjectsScene(query) {
    const scope = document.getElementById('geo_objects') || document;
    const d = query?.geo_objects || {};
    const o1 = d.o1 || {};
    const o2s = collectO2s(d);

    if (!o1?.objectId || !o2s.length) return;

    // 1) Відкрити режим і підставити О1 (категорія, назва, БАЗОВИЙ діаметр)
    setDetailsOpen('geo');           // головна секція «Географія»
    setDetailsOpen('geo_objects');   // підсекція «Об’єкти»
    setSelectValue('geoObjCategoryObject1', o1.categoryKey, o1.categoryKey);
    setSelectValue('geoObjObject1',         o1.objectId,   o1.name);
    // ВАЖЛИВО: baseline читається з #geoObjBaselineDiameter (у метрах)
    setNumberInput('geoObjBaselineDiameter', o1.baselineDiameterMeters);

    // 2) ПОСЛІДОВНО застосувати кожний О2 через еталонний обробник
    for (const item of o2s) {
      if (!item) continue;
      setSelectValue('geoObjCategoryObject2', item.categoryKey, item.categoryKey);
      setSelectValue('geoObjObject2',         item.objectId,   item.name);
      try {
        onGeoObjectsCalculate({ scope });
      } catch (e) {
        console.error('[geo_objects_applier] onGeoObjectsCalculate failed for O2:', item, e);
      }
      await new Promise(r => setTimeout(r, 0));
    }

    // 3) Одноразова автоперемальовка на перший рух центру
    setupFirstCenterRepaint(query);
  }

  // ---- реєстрація
  function registerOrQueue() {
    if (window?.orbit?.registerSceneApplier) {
      window.orbit.registerSceneApplier('geo_objects', applyGeoObjectsScene);
    } else {
      (window.__orbit_pending_appliers__ ||= []).push({ mode: 'geo_objects', fn: applyGeoObjectsScene });
    }
  }
  registerOrQueue();
})();
