// /cabinet/js/appliers/math_applier.js
// Відтворення сцени «Математика» БЕЗ кліку по «Розрахувати».
// Малює О1 і ПО ЧЕРЗІ всі О2, викликаючи еталонний обробник режиму.
// Додає одноразовий «сторож»: на перший рух центру повністю очищує шар і перемальовує сцену.

import { onMathCalculate } from '/js/events/math_buttons.js';
import { setModeLabelKeys } from '/js/ui/infoPanel.js';

(function registerMathApplier(){
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
    if (!query || query.__math_applier_reapplied) return;

    // перед установкою нового — прибрати попередній, якщо ще не спрацював
    clearPendingCenterOnce();

    const once = async () => {
      // зняти той самий handler з усіх назв подій, аби він гарантовано спрацював лише раз
      clearPendingCenterOnce();

      try {
        window.dispatchEvent(new Event('orbit:ui-reset'));
      } catch (_) {}

      try {
        const q2 = { ...query, __math_applier_reapplied: true };
        await applyMathScene(q2);
      } catch (e) {
        console.error('[math_applier] repaint after center change failed:', e);
      }
    };

    pendingCenterOnce = once;
    for (const ev of CENTER_EVS) {
      window.addEventListener(ev, once, { once: true });
    }
  }

  // ---------- головний аплаєр ----------
  async function applyMathScene(query) {
    const scope = document.getElementById('math') || document;
    const d = query?.math || {};
    const o1 = d.o1 || {};
    const o2s = collectO2s(d);

    if (!o1?.objectId || !o2s.length) return;

    // 1) Відкрити режим і підставити О1 (категорія, назва, діаметр)
    setDetailsOpen('math');
    setSelectValue('mathCategoryObject1', o1.categoryKey, o1.categoryKey);
    setSelectValue('mathObject1',         o1.objectId,   o1.name);
    // ВАЖЛИВО: режим «Математика» читає baseline з #mathBaselineDiameter
    setNumberInput('mathBaselineDiameter', o1.baselineDiameterMeters);
    // Підпис інфопанелі: «Математика»
    setModeLabelKeys({
      modeKey: 'panel_title_math'
    });


    // 2) ПОСЛІДОВНО застосувати кожний О2 через еталонний обробник (без кліків і без change/input)
    for (const item of o2s) {
      if (!item) continue;

      setSelectValue('mathCategoryObject2', item.categoryKey, item.categoryKey);
      setSelectValue('mathObject2',         item.objectId,   item.name);

      try {
        onMathCalculate({ scope });
      } catch (e) {
        console.error('[math_applier] onMathCalculate failed for O2:', item, e);
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
      window.orbit.registerSceneApplier('math', applyMathScene);
    } else {
      (window.__orbit_pending_appliers__ ||= []).push({
        mode: 'math',
        fn: applyMathScene
      });
    }
  }

  registerOrQueue();
})();
