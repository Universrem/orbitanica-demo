// /cabinet/js/appliers/univers_distance_applier.js
// Відтворення сцени «Відстань» БЕЗ кліку по «Розрахувати».
// Малює О1 і ПО ЧЕРЗІ всі О2, викликаючи еталонний обробник режиму.
// Додає одноразовий «сторож»: на перший рух центру повністю очищує шар і перемальовує сцену.
// ВАЖЛИВО: якщо у O2 є snapshot — прикріплюю його до option у селекті О2 (dataset),
// щоб адаптер/калькулятор могли взяти значення напряму без пошуку в бібліотеці.

import { onDistanceCalculate } from '/js/events/distance_buttons.js';
import { setModeLabelKeys } from '/js/ui/infoPanel.js';

(function registerUniversDistanceApplier(){
  'use strict';

  const CENTER_EVS = ['orbit:center-changed','orbit:centerChanged','og:center-changed','og:centerChanged'];
  let pendingCenterOnce = null;
  let __lastQuery = null; // збережемо останню сцену для легкого перерендеру назв

  /* ────────────────────────── Мова та i18n-хелпери ────────────────────────── */

  const LANGS = ['en','es','ua']; // алфавітно за кодом

  function normalizeLang(raw) {
    const s = String(raw || '').toLowerCase().trim();
    if (s.startsWith('ua')) return 'ua';
    if (s.startsWith('en')) return 'en';
    if (s.startsWith('es')) return 'es';
    return '';
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
      return normalizeLang(cand) || 'ua';
    } catch { return 'ua'; }
  }
  function langsOrder(curr) {
    const c = (curr || 'ua').toLowerCase();
    return [c, ...LANGS.filter(x => x !== c)];
  }
  const trim = v => (v == null ? '' : String(v).trim());

  // Універсальний пікер *_ua/*_en/*_es → одне значення з фолбеком: поточна → інші
  function pickLocalized(src, base, lang) {
    const order = langsOrder(lang);
    for (const L of order) {
      const v = trim(src?.[`${base}_${L}`]);
      if (v) return v;
    }
    return trim(src?.[base]);
  }

  function clearPendingCenterOnce() {
    if (!pendingCenterOnce) return;
    for (const ev of CENTER_EVS) {
      window.removeEventListener(ev, pendingCenterOnce);
    }
    pendingCenterOnce = null;
  }

  // Будь-який повний reset знімає ще не спрацювали "одноразові" слухачі
  window.addEventListener('orbit:ui-reset', clearPendingCenterOnce);

  /* ────────────────────────── БАР’ЄРИ ГОТОВНОСТІ ────────────────────────── */

  // Очікувач події; якщо слухачів немає — не блокуємось і резолвимось одразу.
  function waitEventOnce(type) {
    return new Promise(resolve => {
      let resolved = false;
      const on = () => { if (!resolved) { resolved = true; resolve(); } };
      // якщо подію ніхто не шле — резолвимося в наступному тіку
      queueMicrotask(() => { if (!resolved) on(); });
      window.addEventListener(type, on, { once: true });
    });
  }

  // Очікувач "готово", якщо існує універсальний проміс
  async function waitIfPromise(p) {
    if (!p) return;
    try {
      if (typeof p.then === 'function') await p;
    } catch(_) {}
  }

  async function waitAllPrereqs() {
    // i18n
    const i18nReady = (window.i18n && window.i18n.ready) ? window.i18n.ready : waitEventOnce('i18n:ready');

    // мапа/рендер (або миттєво, якщо вже готово)
    const mapReady = window.orbit?.mapReadyPromise || waitEventOnce('orbit:map-ready');

    // спільна бібліотека (per-mode), якщо експортує ready; інакше — не блокуємось
    const libReady =
      (window.univers_lib && typeof window.univers_lib.ready === 'function')
        ? window.univers_lib.ready('distance')
        : waitEventOnce('univers-lib:ready:distance');

    // стор юзер-об’єктів (per-mode)
    const userStoreReady =
      (window.userObjects && typeof window.userObjects.ready === 'function')
        ? window.userObjects.ready('distance')
        : waitEventOnce('user-objects:loaded');

    await Promise.all([waitIfPromise(i18nReady), waitIfPromise(mapReady), waitIfPromise(libReady), waitIfPromise(userStoreReady)]);
  }

  /* ────────────────────────── DOM-хелпери ────────────────────────── */

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
  function setSelectValue(id, value, label, datasetObj) {
    if (value == null) return;
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;

    const opt = ensureSelectOption(sel, value, label);

    if (datasetObj && typeof datasetObj === 'object') {
      try {
        opt.dataset.snapshot = JSON.stringify(datasetObj);
      } catch (e) {
        console.warn('[univers_distance_applier] Failed to attach dataset snapshot:', e);
      }
    }

    sel.value = String(value);
  }

  function setNumberInput(id, n) {
    if (n == null) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(n);
  }

  /* ─────────────────── утиліти для локалізації назви/категорії О2 ─────────────────── */

  function buildDatasetSnapshot(item) {
    // Якщо snapshot уже є — доповнимо його; інакше зберемо з item
    const s = (item && typeof item.snapshot === 'object') ? { ...item.snapshot } : {};
    // гарантуємо наявність ключових полів
    s.id = s.id ?? item?.objectId ?? null;
    s.category_key = s.category_key ?? item?.categoryKey ?? null;

    // одиниці/значення (не впливає на підпис, але корисно калькулятору)
    if (s.value == null && item?.snapshot?.value != null) s.value = item.snapshot.value;
    if (s.unit == null && item?.snapshot?.unit != null) s.unit = item.snapshot.unit;

    // i18n назви/опису/категорії — не перезаписуємо на порожні
    const copyIf = (field) => {
      if (trim(s[field])) return;
      const v = trim(item?.snapshot?.[field] ?? item?.[field]);
      if (v) s[field] = v;
    };
    ['name_ua','name_en','name_es','description_ua','description_en','description_es','category_ua','category_en','category_es']
      .forEach(copyIf);

    return s;
  }

  function pickO2Label(item) {
    const lang = currentLang();
    const s = buildDatasetSnapshot(item);

    const label = pickLocalized(s, 'name', lang) || trim(item?.name) || String(item?.objectId ?? '');
    return label;
  }

  function pickCategoryLabel(item) {
    const lang = currentLang();
    const s = buildDatasetSnapshot(item);
    const label = pickLocalized(s, 'category', lang);
    return label || (s.category_key != null ? String(s.category_key) : '');
  }

  function pickO2Value(item) {
    // value лишаємо "як зараз" — співпадає з людською назвою;
    // розрахунок візьме дані зі snapshot (dataset)
    return pickO2Label(item);
  }

  /* ───────────────────── збір O2 зі сцени ───────────────────── */

  function collectO2s(d) {
    if (Array.isArray(d?.o2s) && d.o2s.length) return d.o2s.filter(Boolean);
    if (d?.o2) return [d.o2];
    return [];
  }

  /* ───────────── одноразовий «сторож» першої зміни центру ───────────── */

  function setupFirstCenterRepaint(query) {
    if (!query || query.__univers_distance_applier_reapplied) return;

    clearPendingCenterOnce();

    const once = async () => {
      clearPendingCenterOnce();
      try { window.dispatchEvent(new Event('orbit:ui-reset')); } catch (_) {}
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

  /* ───────────────────── головний аплаєр ───────────────────── */

  async function applyUniversDistanceScene(query) {
    __lastQuery = query; // запам'ятаємо для легкого локального перерендеру
    const scope = document.getElementById('univers_distance') || document;
    const d = query?.univers_distance || {};
    const o1 = d.o1 || {};
    const o2s = collectO2s(d);

    if (!o1?.objectId || !o2s.length) return;

    // Детермінований бар’єр: карта + бібліотека + стор + i18n
    await waitAllPrereqs();

    // О1
    setDetailsOpen('univers_distance');
    setSelectValue('distObject1',       o1.objectId, o1.name);
    setNumberInput('distCircleObject1', o1.baselineDiameterMeters);
    setModeLabelKeys({ modeKey: 'panel_title_univers', subKey: 'panel_title_univers_distance' });

    // О2 — послідовно
    for (const item of o2s) {
      if (!item) continue;

      const o2Label = pickO2Label(item);
      const o2Value = pickO2Value(item);
      const categoryLabel = pickCategoryLabel(item);

      const snapshot = buildDatasetSnapshot(item);

      // 1) Категорія (label локалізований, value — ключ)
      const categoryKeyForSelect =
        snapshot?.category_key ?? item?.categoryKey ?? null;
      setSelectValue('distCategoryObject2', categoryKeyForSelect, categoryLabel);

      // 2) Об’єкт О2 зі snapshot у dataset
      setSelectValue('distObject2', o2Value, o2Label, snapshot);

      // 3) Сигнал іншим елементам (опційно)
      try {
        window.dispatchEvent(new CustomEvent('univers-distance:o2-snapshot', {
          detail: { name: o2Label, category_key: snapshot?.category_key ?? null, snapshot }
        }));
      } catch {}

      // 4) ЯВНИЙ розрахунок (ідемпотентний)
      try {
        onDistanceCalculate({ scope });
      } catch (e) {
        console.error('[univers_distance_applier] onDistanceCalculate failed for O2:', item, e);
      }

      await new Promise(r => setTimeout(r, 0));
    }

    // Одноразовий "сторож" на перший рух
    setupFirstCenterRepaint(query);
  }

  /* ───────────────────── Локальний перерендер назв при зміні мови ───────────────────── */

  function relabelO2ForCurrentLang() {
    // Легко: лише оновити підписи option у двох селектах без перерахунку
    const lang = currentLang();
    const selCat = document.getElementById('distCategoryObject2');
    const selObj = document.getElementById('distObject2');

    if (selObj && selObj.selectedOptions && selObj.selectedOptions.length) {
      const opt = selObj.selectedOptions[0];
      const snap = safeParse(opt?.dataset?.snapshot);
      if (snap) {
        const newLabel = pickLocalized(snap, 'name', lang) || trim(opt.textContent);
        if (newLabel && newLabel !== trim(opt.textContent)) opt.textContent = newLabel;
      }
    }
    if (selCat && selCat.selectedOptions && selCat.selectedOptions.length) {
      const opt = selCat.selectedOptions[0];
      const snap = safeParse(document.querySelector('#distObject2 option[selected]')?.dataset?.snapshot) ||
                   safeParse(document.querySelector('#distObject2 option:checked')?.dataset?.snapshot);
      // намагаємось взяти категорію зі snapshot об'єкта
      if (snap) {
        const newCat = pickLocalized(snap, 'category', lang);
        if (newCat && newCat !== trim(opt.textContent)) opt.textContent = newCat;
      }
    }
  }

  function safeParse(j) { try { return j ? JSON.parse(j) : null; } catch { return null; } }

  // Підпишемось на типові події зміни мови → легкий relabel
  try {
    ['languageChanged','lang-changed','i18n:changed','i18nextLanguageChanged'].forEach(ev => {
      document.addEventListener(ev, () => { relabelO2ForCurrentLang(); });
    });
  } catch {}

  /* ───────────────────── реєстрація ───────────────────── */

  function registerOrQueue() {
    if (window?.orbit?.registerSceneApplier) {
      window.orbit.registerSceneApplier('univers_distance', applyUniversDistanceScene);
    } else {
      (window.__orbit_pending_appliers__ ||= []).push({ mode: 'univers_distance', fn: applyUniversDistanceScene });
    }
  }

  registerOrQueue();
})();
