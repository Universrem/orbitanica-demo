// Відтворення сцени «Відстань» БЕЗ кліку по «Розрахувати».
// Модель одна: у сцені вже є повні дані (snapshot) кожного О2.
// Ми лише підставляємо їх у селекти (з прикріпленим snapshot у dataset) і викликаємо еталонний onDistanceCalculate.

import { onDistanceCalculate } from '/js/events/distance_buttons.js';
import { setModeLabelKeys } from '/js/ui/infoPanel.js';

(function registerUniversDistanceApplier(){
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
    if (!query || query.__univers_distance_applier_reapplied) return;

    clearPendingCenterOnce();

    const once = async () => {
      clearPendingCenterOnce();
      try { window.dispatchEvent(new Event('orbit:ui-reset')); } catch {}
      try {
        const q2 = { ...query, __univers_distance_applier_reapplied: true };
        await new Promise(r => setTimeout(r, 0));
        await applyUniversDistanceScene(q2);
      } catch (e) {
        console.error('[univers_distance_applier] reapply after first center move failed:', e);
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

  // Додає/оновлює option у <select>, повертає сам option (для dataset)
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

  // Ставимо значення <select> БЕЗ dispatchEvent; за потреби додаємо dataset до option
  function setSelectValue(id, value, label, snapshot) {
    if (value == null) return;
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;

    const opt = ensureSelectOption(sel, value, label);
    if (snapshot && typeof snapshot === 'object') {
      try { opt.dataset.snapshot = JSON.stringify(snapshot); }
      catch (e) { console.warn('[univers_distance_applier] Failed to attach snapshot:', e); }
    }
    sel.value = String(value);
  }

  function setNumberInput(id, n) {
    if (n == null) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(n);
  }

  /* ───────────── збір О2 ───────────── */

  function collectO2s(d) {
    if (Array.isArray(d?.o2s) && d.o2s.length) return d.o2s.filter(Boolean);
    if (d?.o2) return [d.o2];
    return [];
  }

  /* ───────────── основний аплаєр ───────────── */

  async function applyUniversDistanceScene(query) {
    const scope = document.getElementById('univers_distance') || document;
    const d = query?.univers_distance || {};
    const o1 = d.o1 || {};
    const o2s = collectO2s(d);

    if (!o1?.objectId || !o2s.length) return;

    // Відкрити режим, виставити О1
    setDetailsOpen('univers_distance');
    setSelectValue('distObject1',       o1.objectId, o1.name);
    setNumberInput('distCircleObject1', o1.baselineDiameterMeters);
    setModeLabelKeys({ modeKey: 'panel_title_univers', subKey: 'panel_title_univers_distance' });

    // О2 — строго по snapshot кожного запису сцени
    const lang = currentLang();

    for (const item of o2s) {
      if (!item || !item.snapshot) {
        console.warn('[univers_distance_applier] O2 without snapshot skipped:', item);
        continue;
      }
      const s = item.snapshot;

      // Стабільні ключі
      const categoryKey = s.category_key ?? item.categoryKey ?? null;
      const objectId    = s.id ?? item.objectId ?? null;

      if (categoryKey == null || objectId == null) {
        console.warn('[univers_distance_applier] O2 lacks identifiers (category_key/id). Skipped.', item);
        continue;
      }

      // Локалізовані підписи
      const catLabel = pickLocalized(s, 'category', lang) || String(categoryKey);
      const objLabel = pickLocalized(s, 'name', lang)     || String(objectId);

      // 1) Категорія (value = внутрішній ключ, label = локалізований)
      setSelectValue('distCategoryObject2', categoryKey, catLabel);

      // 2) Об’єкт О2: value = стабільний id, label = локалізована назва, snapshot у dataset
      setSelectValue('distObject2', objectId, objLabel, s);

      // 3) Запуск розрахунку для цього О2
      try {
        onDistanceCalculate({ scope });
      } catch (e) {
        console.error('[univers_distance_applier] onDistanceCalculate failed for O2:', item, e);
      }

      // невелика пауза між кроками
      await new Promise(r => setTimeout(r, 0));
    }

    // одноразовий перерендер після першого руху центру
    setupFirstCenterRepaint(query);
  }

  /* ───────────── реєстрація ───────────── */

  function registerOrQueue() {
    if (window?.orbit?.registerSceneApplier) {
      window.orbit.registerSceneApplier('univers_distance', applyUniversDistanceScene);
    } else {
      (window.__orbit_pending_appliers__ ||= []).push({ mode: 'univers_distance', fn: applyUniversDistanceScene });
    }
  }

  registerOrQueue();
})();
