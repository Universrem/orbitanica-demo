// /cabinet/js/appliers/univers_mass_applier.js
// Відтворення сцени «Маса» БЕЗ кліку по «Розрахувати».
// Малює О1 і ПО ЧЕРЗІ всі О2, викликаючи еталонний обробник режиму.
// Додає одноразовий «сторож»: на перший рух центру повністю очищує шар і перемальовує сцену.

import { onMassCalculate } from '/js/events/mass_buttons.js';

(function registerUniversMassApplier(){
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

  // Нормалізуємо масив О2 (беремо d.o2s або одинарний d.o2)
  function collectO2s(d) {
    if (Array.isArray(d?.o2s) && d.o2s.length) return d.o2s.filter(Boolean);
    if (d?.o2) return [d.o2];
    return [];
  }

  // ---------- одноразовий «сторож» першої зміни центру (без накопичення) ----------
  function setupFirstCenterRepaint(query) {
    if (!query || query.__univers_mass_applier_reapplied) return;

    // перед установкою нового — прибрати попередній, якщо ще не спрацював
    clearPendingCenterOnce();

    const once = async () => {
      // зняти той самий handler з усіх назв подій, аби він гарантовано спрацював лише раз
      clearPendingCenterOnce();

      try {
        window.dispatchEvent(new Event('orbit:ui-reset'));
      } catch (_) {}

      try {
        const q2 = { ...query, __univers_mass_applier_reapplied: true };
        await applyUniversMassScene(q2);
      } catch (e) {
        console.error('[univers_mass_applier] repaint after center change failed:', e);
      }
    };

    pendingCenterOnce = once;
    for (const ev of CENTER_EVS) {
      window.addEventListener(ev, once, { once: true });
    }
  }

  // ---------- головний аплаєр ----------
  async function applyUniversMassScene(query) {
    const scope = document.getElementById('univers_mass') || document;
    const d = query?.univers_mass || {};
    const o1 = d.o1 || {};
    const o2s = collectO2s(d);

    if (!o1?.objectId || !o2s.length) return;

    // 1) Відкрити режим і підставити О1 (категорія, назва, діаметр)
    setDetailsOpen('univers_mass');
    setSelectValue('massCategoryObject1', o1.categoryKey, o1.categoryKey);
    setSelectValue('massObject1',         o1.objectId,   o1.name);
    setNumberInput('massBaselineDiameter', o1.baselineDiameterMeters);

    // 2) ПОСЛІДОВНО застосувати кожний О2 через еталонний обробник (без кліків і без change/input)
    for (const item of o2s) {
      if (!item) continue;

      setSelectValue('massCategoryObject2', item.categoryKey, item.categoryKey);
      setSelectValue('massObject2',         item.objectId,   item.name);

      try {
        onMassCalculate({ scope });
      } catch (e) {
        console.error('[univers_mass_applier] onMassCalculate failed for O2:', item, e);
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
      window.orbit.registerSceneApplier('univers_mass', applyUniversMassScene);
    } else {
      (window.__orbit_pending_appliers__ ||= []).push({
        mode: 'univers_mass',
        fn: applyUniversMassScene
      });
    }
  }

  registerOrQueue();
})();
