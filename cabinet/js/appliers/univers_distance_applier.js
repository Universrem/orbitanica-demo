// /cabinet/js/appliers/univers_distance_applier.js
// Відтворення сцени «Відстань» БЕЗ кліку по «Розрахувати».
// Малює О1 і ПО ЧЕРЗІ всі О2, викликаючи еталонний обробник режиму.
// Додає одноразовий «сторож»: на перший рух центру повністю очищує шар і перемальовує сцену.

import { onDistanceCalculate } from '/js/events/distance_buttons.js';

(function registerUniversDistanceApplier(){
  'use strict';

  // ---- control for single pending "first center move" handler
  const CENTER_EVS = ['orbit:center-changed','orbit:centerChanged','og:center-changed','og:centerChanged'];
  let pendingCenterOnce = null;

  function clearPendingCenterOnce() {
    if (!pendingCenterOnce) return;
    for (const ev of CENTER_EVS) {
      window.removeEventListener(ev, pendingCenterOnce);
    }
    pendingCenterOnce = null;
  }

  // safety: будь-який повний reset знімає ще не спрацювали "одноразові" слухачі
  window.addEventListener('orbit:ui-reset', clearPendingCenterOnce);

  // ---------- маленькі DOM-хелпери ----------
  function setDetailsOpen(id) {
    const det = document.getElementById(id);
    if (det && 'open' in det) det.open = true;
  }

  // ВАЖЛИВО: ставимо значення БЕЗ штучних подій change/input
  function setSelectValue(id, value, label) {
    if (value == null) return;
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;

    const val = String(value);
    let has = false;
    for (const o of sel.options) {
      if (String(o.value) === val) { has = true; break; }
    }
    if (!has) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label != null ? String(label) : val;
      sel.appendChild(opt);
    }
    sel.value = val;
    // без dispatchEvent
  }

  function setNumberInput(id, n) {
    if (n == null) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(n);
    // без dispatchEvent
  }

  // Нормалізуємо масив О2 (беремо univers_distance.o2s або одинарний univers_distance.o2)
  function collectO2s(d) {
    if (Array.isArray(d?.o2s) && d.o2s.length) return d.o2s.filter(Boolean);
    if (d?.o2) return [d.o2];
    return [];
  }

  // ---------- одноразовий «сторож» першої зміни центру (без накопичення) ----------
  function setupFirstCenterRepaint(query) {
    if (!query || query.__univers_distance_applier_reapplied) return;

    // перед установкою нового — прибрати попередній, якщо ще не спрацював
    clearPendingCenterOnce();

    const once = async () => {
      // зняти той самий handler з усіх назв подій, аби він гарантовано спрацював лише раз
      clearPendingCenterOnce();

      try {
        window.dispatchEvent(new Event('orbit:ui-reset'));
      } catch (_) {}

      try {
        const q2 = { ...query, __univers_distance_applier_reapplied: true };
        // невеличка пауза, щоб reset відпрацював
        await new Promise(r => setTimeout(r, 0));
        await applyUniversDistanceScene(q2);
      } catch (e) {
        console.error('[univers_distance_applier] reapply after first center move failed:', e);
      }
    };

    // запам’ятати, щоб мати можливість зняти, якщо станеться повний reset
    pendingCenterOnce = once;

    for (const ev of CENTER_EVS) {
      window.addEventListener(ev, once, { once: true });
    }
  }

  // ---------- головний аплаєр ----------
  async function applyUniversDistanceScene(query) {
    const scope = document.getElementById('univers_distance') || document;
    const d = query?.univers_distance || {};
    const o1 = d.o1 || {};
    const o2s = collectO2s(d);

    if (!o1?.objectId || !o2s.length) return;

    // 1) Відкрити режим і підставити О1 (назва/ід і базовий діаметр у метрах)
    setDetailsOpen('univers_distance');
    // У «Відстані» О1 — лише один селектор
    setSelectValue('distObject1',       o1.objectId, o1.name);
    setNumberInput('distCircleObject1', o1.baselineDiameterMeters);

    // 2) ПОСЛІДОВНО застосувати кожний О2 через еталонний обробник (без кліків і без change/input)
    for (const item of o2s) {
      if (!item) continue;

      setSelectValue('distCategoryObject2', item.categoryKey, item.categoryKey);
      setSelectValue('distObject2',         item.objectId,   item.name);

      try {
        onDistanceCalculate({ scope });
      } catch (e) {
        console.error('[univers_distance_applier] onDistanceCalculate failed for O2:', item, e);
      }

      // невеличка пауза між кроками
      await new Promise(r => setTimeout(r, 0));
    }

    // 3) Увімкнути одноразову автоперемальовку на перший рух центру
    setupFirstCenterRepaint(query);
  }

  // ---------- реєстрація або постановка в чергу ----------
  function registerOrQueue() {
    if (window?.orbit?.registerSceneApplier) {
      window.orbit.registerSceneApplier('univers_distance', applyUniversDistanceScene);
    } else {
      (window.__orbit_pending_appliers__ ||= []).push({
        mode: 'univers_distance',
        fn: applyUniversDistanceScene
      });
    }
  }

  registerOrQueue();
})();
