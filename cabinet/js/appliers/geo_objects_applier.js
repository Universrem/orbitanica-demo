// /cabinet/js/appliers/geo_objects_applier.js
// Відтворення сцени «Географія → Об’єкти» БЕЗ кліку по «Старт».
// Еталон «Математика»: локалізуємо лейбли, кладемо snapshot у option.dataset.snapshot
// для О1 та кожного О2, після чого викликаємо onGeoObjectsCalculate.

import { onGeoObjectsCalculate } from '/js/events/geo_objects_buttons.js';
import { setModeLabelKeys } from '/js/ui/infoPanel.js';

(function registerGeoObjectsApplier(){
  'use strict';

  /* ───────────── мова ───────────── */

  const LANGS = ['en','es','ua'];
  const trim = v => (v == null ? '' : String(v).trim());

  function normalizeLang(raw) {
    const s = String(raw || '').toLowerCase().trim();
    if (s.startsWith('ua')) return 'ua';
    if (s.startsWith('en')) return 'en';
    if (s.startsWith('es')) return 'es';
    return 'ua';
  }
  function currentLang() {
    try {
      const cand =
        (typeof window !== 'undefined' && (window.__I18N_LANG || window.I18N_LANG || window.APP_LANG || window.LANG)) ||
        (document?.documentElement?.getAttribute('lang') || '') ||
        (typeof localStorage !== 'undefined' && (
          localStorage.getItem('i18nextLng') ||
          localStorage.getItem('lang') ||
          localStorage.getItem('ui.lang') ||
          localStorage.getItem('app.lang') ||
          localStorage.getItem('locale') || ''
        )) ||
        (typeof navigator !== 'undefined' && (navigator.language || (navigator.languages && navigator.languages[0]) || '')) ||
        '';
      return normalizeLang(cand);
    } catch { return 'ua'; }
  }
  function langsOrder(curr) {
    const c = (curr || 'ua').toLowerCase();
    return [c, ...LANGS.filter(x => x !== c)];
  }
  function pickLocalized(src, base, lang) {
    const order = langsOrder(lang);
    for (const L of order) {
      const v = trim(src?.[`${base}_${L}`]);
      if (v) return v;
    }
    return trim(src?.[base]);
  }

  /* ───────────── одноразовий «сторож» першого руху центру ───────────── */

  const CENTER_EVS = ['orbit:center-changed','orbit:centerChanged','og:center-changed','og:centerChanged'];
  let pendingCenterOnce = null;

  function clearPendingCenterOnce() {
    if (!pendingCenterOnce) return;
    for (const ev of CENTER_EVS) window.removeEventListener(ev, pendingCenterOnce);
    pendingCenterOnce = null;
  }
  window.addEventListener('orbit:ui-reset', clearPendingCenterOnce);

  function setupFirstCenterRepaint(query) {
    if (!query || query.__geo_objects_applier_reapplied) return;

    clearPendingCenterOnce();

    const once = async () => {
      clearPendingCenterOnce();
      try { window.dispatchEvent(new Event('orbit:ui-reset')); } catch {}
      try {
        const q2 = { ...query, __geo_objects_applier_reapplied: true };
        await new Promise(r => setTimeout(r, 0));
        await applyGeoObjectsScene(q2);
      } catch (e) {
        console.error('[geo_objects_applier] reapply after first center move failed:', e);
      }
    };

    pendingCenterOnce = once;
    for (const ev of CENTER_EVS) window.addEventListener(ev, once, { once: true });
  }

  /* ───────────── невеликі DOM-хелпери ───────────── */

  function setDetailsOpen(id) {
    const det = document.getElementById(id);
    if (det && 'open' in det) det.open = true;
  }

  // Додає/оновлює option у <select>, повертає option (щоб дописати dataset)
  function ensureSelectOption(selectEl, value, label) {
    const val = String(value);
    let opt = null;
    for (const o of selectEl.options) {
      if (String(o.value) === val) { opt = o; break; }
    }
    if (!opt) {
      opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label != null ? String(label) : val;
      selectEl.appendChild(opt);
    } else if (label != null && String(opt.textContent).trim() !== String(label)) {
      opt.textContent = String(label);
    }
    return opt;
  }

  // Ставимо значення <select> БЕЗ dispatchEvent; опційно додаємо snapshot у option.dataset.snapshot
  function setSelectValue(id, value, label, snapshot) {
    if (value == null) return;
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;

    const opt = ensureSelectOption(sel, value, label);
    if (snapshot && typeof snapshot === 'object') {
      try { opt.dataset.snapshot = JSON.stringify(snapshot); }
      catch (e) { console.warn('[geo_objects_applier] Failed to attach snapshot:', e); }
    }
    sel.value = String(value);
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

  /* ───────────── основний аплаєр ───────────── */

  async function applyGeoObjectsScene(query) {
    const scope = document.getElementById('geo_objects') || document;
    const d = query?.geo_objects || {};
    const o1 = d.o1 || {};
    const o2s = collectO2s(d);

    // Потрібні: О1 з snapshot + хоча б один О2
    if (!o1?.objectId || !o1?.snapshot || !o2s.length) return;

    setModeLabelKeys({ modeKey: 'panel_title_geo', subKey: 'panel_title_geo_objects' });

    const lang = currentLang();

    // 1) Відкрити режим, підставити О1 із локалізованими лейблами + snapshot у dataset
    setDetailsOpen('geo');           // головна секція «Географія»
    setDetailsOpen('geo_objects');   // підсекція «Об’єкти»

    const s1 = o1.snapshot;
    const catKey1 = (s1?.category_key ?? o1.categoryKey ?? null);
    const objId1  = (s1?.id ?? o1.objectId ?? null);

    const catLabel1 = pickLocalized(s1, 'category', lang) || String(catKey1 ?? '');
    const objLabel1 = pickLocalized(s1, 'name',     lang) || String(objId1  ?? '');

    setSelectValue('geoObjCategoryObject1', catKey1, catLabel1);
    setSelectValue('geoObjObject1',         objId1,  objLabel1, s1);
    setNumberInput('geoObjBaselineDiameter', o1.baselineDiameterMeters);

    // 2) ПОСЛІДОВНО застосувати кожний О2 (локалізація + snapshot у dataset → розрахунок)
    for (const item of o2s) {
      if (!item || !item.snapshot) {
        console.warn('[geo_objects_applier] O2 without snapshot skipped:', item);
        continue;
      }
      const s = item.snapshot;

      const catKey2 = (s.category_key ?? item.categoryKey ?? null);
      const objId2  = (s.id ?? item.objectId ?? null);

      if (catKey2 == null || objId2 == null) {
        console.warn('[geo_objects_applier] O2 lacks identifiers (category_key/id). Skipped.', item);
        continue;
      }

      const catLabel2 = pickLocalized(s, 'category', lang) || String(catKey2);
      const objLabel2 = pickLocalized(s, 'name',     lang) || String(objId2);

      setSelectValue('geoObjCategoryObject2', catKey2, catLabel2);
      setSelectValue('geoObjObject2',         objId2,  objLabel2, s);

      try {
        onGeoObjectsCalculate({ scope });
      } catch (e) {
        console.error('[geo_objects_applier] onGeoObjectsCalculate failed for O2:', item, e);
      }

      await new Promise(r => setTimeout(r, 0));
    }

    // 3) Одноразове повне перезастосування після першого руху центру
    setupFirstCenterRepaint(query);
  }

  /* ───────────── реєстрація ───────────── */

  function registerOrQueue() {
    if (window?.orbit?.registerSceneApplier) {
      window.orbit.registerSceneApplier('geo_objects', applyGeoObjectsScene);
    } else {
      (window.__orbit_pending_appliers__ ||= []).push({ mode: 'geo_objects', fn: applyGeoObjectsScene });
    }
  }

  registerOrQueue();
})();
