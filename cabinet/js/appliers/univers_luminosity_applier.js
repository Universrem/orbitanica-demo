// /cabinet/js/appliers/univers_luminosity_applier.js
// Відтворення сцени «Світність» без кліків по «Старт».
// Підставляє О1 і ПОСЛІДОВНО додає всі О2 через еталонний обробник режиму.
// Ставить «сторож» першого руху центру: повний reset і повторне застосування.

import { onLuminosityCalculate } from '/js/events/luminosity_buttons.js';
import { setModeLabelKeys } from '/js/ui/infoPanel.js';

(function registerUniversLuminosityApplier(){
  'use strict';

  const CENTER_EVS = ['orbit:center-changed','orbit:centerChanged','og:center-changed','og:centerChanged'];
  let pendingCenterOnce = null;

  function clearPendingCenterOnce() {
    if (!pendingCenterOnce) return;
    for (const ev of CENTER_EVS) window.removeEventListener(ev, pendingCenterOnce);
    pendingCenterOnce = null;
  }
  window.addEventListener('orbit:ui-reset', clearPendingCenterOnce);

  function setDetailsOpen(id) {
    const det = document.getElementById(id);
    if (det && 'open' in det) det.open = true;
  }

  function setSelectValue(id, value, label) {
    if (value == null) return;
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;
    const val = String(value);
    let has = false;
    for (const o of sel.options) { if (String(o.value) === val) { has = true; break; } }
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
    if (el) el.value = String(n);
  }

  function collectO2s(d) {
    if (Array.isArray(d?.o2s) && d.o2s.length) return d.o2s.filter(Boolean);
    if (d?.o2) return [d.o2];
    return [];
  }

  function setupFirstCenterRepaint(query) {
    if (!query || query.__univers_luminosity_applier_reapplied) return;

    clearPendingCenterOnce();
    const once = async () => {
      clearPendingCenterOnce();
      try { window.dispatchEvent(new Event('orbit:ui-reset')); } catch {}
      try {
        const q2 = { ...query, __univers_luminosity_applier_reapplied: true };
        await new Promise(r => setTimeout(r, 0));
        await applyUniversLuminosityScene(q2);
      } catch (e) {
        console.error('[univers_luminosity_applier] reapply failed:', e);
      }
    };
    pendingCenterOnce = once;
    for (const ev of CENTER_EVS) window.addEventListener(ev, once, { once: true });
  }

  async function applyUniversLuminosityScene(query) {
    const scope = document.getElementById('univers_luminosity') || document;
    const d = query?.univers_luminosity || {};
    const o1 = d.o1 || {};
    const o2s = collectO2s(d);

    if (!o1?.objectId || !o2s.length) return;

    // 1) Відкрити режим і підставити О1 (категорія+об’єкт+діаметр у м)
    setDetailsOpen('univers_luminosity');
    setSelectValue('lumiCategoryObject1', o1.categoryKey, o1.categoryKey);
    setSelectValue('lumiObject1',         o1.objectId,    o1.name);
    setNumberInput('lumiCircleObject1',   o1.baselineDiameterMeters);
    // Підпис інфопанелі: Всесвіт: Світність (ключі вже є у словнику)
    setModeLabelKeys({
      modeKey: 'panel_title_univers',
      subKey:  'panel_title_univers_luminosity'
    });


    // 2) Послідовно підставляти О2 і викликати штатний обробник
    for (const item of o2s) {
      if (!item) continue;
      setSelectValue('lumiCategoryObject2', item.categoryKey, item.categoryKey);
      setSelectValue('lumiObject2',         item.objectId,   item.name);

      try { onLuminosityCalculate({ scope }); }
      catch (e) { console.error('[univers_luminosity_applier] onLuminosityCalculate failed:', e); }

      await new Promise(r => setTimeout(r, 0));
    }

    setupFirstCenterRepaint(query);
  }

  function registerOrQueue() {
    if (window?.orbit?.registerSceneApplier) {
      window.orbit.registerSceneApplier('univers_luminosity', applyUniversLuminosityScene);
    } else {
      (window.__orbit_pending_appliers__ ||= []).push({ mode: 'univers_luminosity', fn: applyUniversLuminosityScene });
    }
  }

  registerOrQueue();
})();
