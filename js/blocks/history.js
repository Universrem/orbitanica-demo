// /js/blocks/history.js
'use strict';

/**
 * Режим «Історія» (UI) — SNAPSHOT-FIRST, строго за еталоном «Географія → Населення».
 * ЄДИНА різниця: у об'єкта завжди є start (обов'язково), end — опційно.
 * - О1 і О2: категорії/об'єкти з history-бібліотеки (мердж OFFICIAL + UGC);
 * - у КОЖНОМУ <option> зберігаємо snapshot в dataset.snapshot:
 *   {
 *     id, category_key,
 *     value: <start>, unit: 'year',
 *     value2?: <end>, unit2: 'year',
 *     name_ua/en/es, description_ua/en/es, category_ua/en/es
 *   }
 * - відновлення вибору за snapshot.id; UGC позначається (корист.);
 * - слухаємо reload/ready, зміну мови, orbit:ui-reset.
 */

import { t, getCurrentLang } from '../i18n.js';
import { loadHistoryLibrary, getHistoryLibrary } from '../data/history_lib.js';
import { attachO1QuickSuggest } from '../utils/o1QuickSuggest.js';

/* ─────────────────────────────────────────────────────────────
   Утіліти
───────────────────────────────────────────────────────────── */

const s   = v => String(v ?? '').trim();
const low = v => s(v).toLowerCase();

function currLangBase() {
  const raw = (getCurrentLang && getCurrentLang()) || '';
  const base = String(raw).toLowerCase().split(/[-_]/)[0];
  return ['ua','en','es'].includes(base) ? base : 'ua';
}

function isUser(rec) {
  return !!(rec?.is_user_object || rec?.source === 'user');
}

// Валідація «історії»: start обов'язковий, end опційний
function hasValidHistory(rec) {
  const v1 = Number(rec?.time_start?.value);
  return Number.isFinite(v1);
}

function getCatKey(rec) {
  return low(rec?.category_key ?? rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

function pickName(rec, lang) {
  // лише назва мовою системи; без фолбеків
  return s(rec?.[`name_${lang}`] || '');
}

function pickCategoryI18n(rec) {
  return {
    ua: s(rec?.category_ua ?? rec?.category_i18n?.ua),
    en: s(rec?.category_en ?? rec?.category_i18n?.en),
    es: s(rec?.category_es ?? rec?.category_i18n?.es),
  };
}

function pickCategoryLabel(i18n, lang) {
  if (lang === 'ua' && i18n.ua) return i18n.ua;
  if (lang === 'en' && i18n.en) return i18n.en;
  if (lang === 'es' && i18n.es) return i18n.es;
  return i18n.ua || i18n.en || i18n.es || '';
}

function clearSelect(el) {
  if (!el) return;
  el.innerHTML = '';
}

function getSelectedSnapshotId(sel) {
  if (!sel) return '';
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return '';
  try {
    const snap = JSON.parse(opt.dataset.snapshot || '{}');
    return snap.id ? String(snap.id) : '';
  } catch { return ''; }
}

/**
 * Прикріпити snapshot історії до option.
 * Формат snapshot (узгоджений з еталоном «населення»):
 *  - value  = start (Number, обов'язково), unit  = 'year'
 *  - value2 = end   (Number, опційно),     unit2 = 'year'
 */
function attachHistorySnapshot(opt, rec) {
  if (!opt || !rec || !hasValidHistory(rec)) return;

  const start = Number(rec?.time_start?.value);
  const end   = Number(rec?.time_end?.value);

  const snap = {
    id: rec?.id ?? null,
    category_key: rec?.category_key ?? rec?.category_id ?? null,

    // start
    value: start,
    unit:  'year',
    unit_key: 'year',

    // локалізація
    name_ua: rec?.name_ua ?? null,
    name_en: rec?.name_en ?? null,
    name_es: rec?.name_es ?? null,

    description_ua: rec?.description_ua ?? null,
    description_en: rec?.description_en ?? null,
    description_es: rec?.description_es ?? null,

    category_ua: rec?.category_ua ?? rec?.category_i18n?.ua ?? null,
    category_en: rec?.category_en ?? rec?.category_i18n?.en ?? null,
    category_es: rec?.category_es ?? rec?.category_i18n?.es ?? null
  };

  // end — опційно (додаємо обидва ключі сумісності)
  if (Number.isFinite(end)) {
    snap.value2    = end;
    snap.unit2     = 'year';
    snap.unit2_key = 'year';
  }

  if (!Number.isFinite(snap.value)) return;
  try { opt.dataset.snapshot = JSON.stringify(snap); } catch {}
  if (isUser(rec)) opt.dataset.user = '1';
}

/* ─────────────────────────────────────────────────────────────
   Категорії (спільно для О1/О2)
───────────────────────────────────────────────────────────── */

function rebuildCategories(scope) {
  const lang = currLangBase();
  const lib  = (getHistoryLibrary() || []).filter(hasValidHistory);

  const sel1 = scope.querySelector('#histCategoryObject1') || scope.querySelector('.object1-group .category-select');
  const sel2 = scope.querySelector('#histCategoryObject2') || scope.querySelector('.object2-group .category-select');
  const selects = [sel1, sel2].filter(Boolean);
  if (!selects.length) return;

  // group by key
  const map = new Map();
  for (const rec of lib) {
    const key = getCatKey(rec);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(rec);
  }

  const categories = [];
  for (const [key, rows] of map.entries()) {
    // показуємо категорію лише якщо є хоч один об'єкт із локалізованою назвою
    const hasLocalizedObj = rows.some(r => hasValidHistory(r) && s(r?.[`name_${lang}`]));
    if (!hasLocalizedObj) continue;

    // підпис категорії
    let labelBase = '';
    for (const r of rows) {
      const i18n = pickCategoryI18n(r);
      const cand = pickCategoryLabel(i18n, lang);
      if (cand) { labelBase = cand; break; }
    }
    if (!labelBase) {
      for (const r of rows) {
        const i18n = pickCategoryI18n(r);
        const cand = i18n.ua || i18n.en || i18n.es || '';
        if (cand) { labelBase = cand; break; }
      }
    }
    if (!labelBase) continue;

    const hasUser = rows.some(isUser);
    const userMark = hasUser ? ` ${t('ui.user_mark') || '(корист.)'}` : '';
    categories.push({ key, label: `${labelBase}${userMark}` });
  }

  categories.sort((a,b) => a.label.localeCompare(b.label, undefined, { sensitivity:'base' }));

  for (const sel of selects) {
    const keep = s(sel.value);
    clearSelect(sel);

    const ph = document.createElement('option');
    ph.value = '';
    ph.disabled = true; ph.selected = true; ph.hidden = true;
    ph.textContent = t('panel_placeholder_category');
    sel.appendChild(ph);

    const frag = document.createDocumentFragment();
    for (const c of categories) {
      const opt = document.createElement('option');
      opt.value = c.key;
      opt.textContent = c.label;
      frag.appendChild(opt);
    }
    sel.appendChild(frag);

    if (keep && categories.some(c => c.key === keep)) sel.value = keep;
  }
}

/* ─────────────────────────────────────────────────────────────
   Об'єкти у вибраній категорії (О1/О2 однакова логіка)
───────────────────────────────────────────────────────────── */

function rebuildObjects(scope, { catSel, objSel, isO1 }) {
  const lang = currLangBase();
  const lib  = (getHistoryLibrary() || []).filter(hasValidHistory);

  const cat = scope.querySelector(catSel);
  const obj = scope.querySelector(objSel);
  if (!obj) return;

  const key = low(cat?.value || '');

  // попередній обраний за snapshot.id
  const prevId = getSelectedSnapshotId(obj);

  clearSelect(obj);
  const ph = document.createElement('option');
  ph.value = '';
  ph.disabled = true; ph.selected = true; ph.hidden = true;
  ph.textContent = isO1 ? t('panel_placeholder_object1') : t('panel_placeholder_object2');
  obj.appendChild(ph);

  if (!key) return;

  const rows = lib.filter(r => getCatKey(r) === key);
  const items = [];
  for (const rec of rows) {
    const name = pickName(rec, lang);
    if (!name) continue;
    const value = String(rec?.id || name); // value = id (фолбек name)
    const label = isUser(rec) ? `${name} ${t('ui.user_mark') || '(корист.)'}` : name;
    items.push({ value, label, rec });
  }

  // без дублів за value
  const seen = new Set();
  const frag = document.createDocumentFragment();
  for (const it of items) {
    if (seen.has(it.value)) continue;
    seen.add(it.value);
    const opt = document.createElement('option');
    opt.value = it.value;
    opt.textContent = it.label;
    attachHistorySnapshot(opt, it.rec);
    frag.appendChild(opt);
  }
  obj.appendChild(frag);

  // Відновити вибір по snapshot.id
  if (prevId) {
    const match = [...obj.options].find(o => {
      try { return JSON.parse(o.dataset.snapshot || '{}').id === prevId; }
      catch { return false; }
    });
    if (match) obj.value = match.value;
  }
}

/* ─────────────────────────────────────────────────────────────
   Reset форми режиму
───────────────────────────────────────────────────────────── */

function resetHistoryForm(scope) {
  // розблокувати О1
  scope.querySelector('.object1-group')?.classList.remove('is-locked');
  scope.querySelectorAll('.object1-group select, .object1-group input').forEach(el => {
    el.disabled = false;
    el.classList.remove('is-invalid');
  });

  // інпут базового діаметра (масштаб)
  const base = scope.querySelector('#historyBaselineDiameter') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) {
    base.placeholder = t('panel_placeholder_input_diameter');
    base.value = '';
  }

  rebuildCategories(scope);
  rebuildObjects(scope, { catSel: '#histCategoryObject1', objSel: '#histObject1', isO1: true });
  rebuildObjects(scope, { catSel: '#histCategoryObject2', objSel: '#histObject2', isO1: false });
}

/* ─────────────────────────────────────────────────────────────
   Ініціалізація
───────────────────────────────────────────────────────────── */

export async function initHistoryBlock() {
  try {
    await loadHistoryLibrary();
  } catch (e) {
    console.error('[history] library load failed:', e);
  }

  const scope = document.getElementById('history');
  if (!scope) { console.warn('[history] #history not found'); return; }

  // стартове заповнення
  rebuildCategories(scope);
  rebuildObjects(scope, { catSel: '#histCategoryObject1', objSel: '#histObject1', isO1: true });
  rebuildObjects(scope, { catSel: '#histCategoryObject2', objSel: '#histObject2', isO1: false });

  // плейсхолдер і підказки для baseline О1
  const base = scope.querySelector('#historyBaselineDiameter') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) {
    base.placeholder = t('panel_placeholder_input_diameter');
        try { attachO1QuickSuggest({ inputEl: base, modeId: 'history' }); } catch {}
  }

  // зміна категорій → оновити список об'єктів у відповідній групі
  scope.querySelector('#histCategoryObject1')?.addEventListener('change', () => {
    rebuildObjects(scope, { catSel: '#histCategoryObject1', objSel: '#histObject1', isO1: true });
  });
  scope.querySelector('#histCategoryObject2')?.addEventListener('change', () => {
    rebuildObjects(scope, { catSel: '#histCategoryObject2', objSel: '#histObject2', isO1: false });
  });

  // перезбірка при оновленні бібліотеки/UGC та зміні мови
  const rebuildAll = () => {
    rebuildCategories(scope);
    rebuildObjects(scope, { catSel: '#histCategoryObject1', objSel: '#histObject1', isO1: true });
    rebuildObjects(scope, { catSel: '#histCategoryObject2', objSel: '#histObject2', isO1: false });
  };

  document.addEventListener('history-lib-reloaded', rebuildAll);
  document.addEventListener('history-lib:ready',   rebuildAll);
  // сумісність зі старими подіями
  document.addEventListener('user-objects-added',   rebuildAll);
  document.addEventListener('user-objects-changed', rebuildAll);
  document.addEventListener('user-objects-removed', rebuildAll);

  // зміна мови
  const onLang = () => rebuildAll();
  document.addEventListener('languageChanged', onLang);
  document.addEventListener('lang-changed', onLang);
  document.addEventListener('i18nextLanguageChanged', onLang);
  document.addEventListener('i18n:ready', onLang);

  // системний UI reset
  const onUiReset = () => resetHistoryForm(scope);
  window.addEventListener('orbit:ui-reset', onUiReset);
  document.addEventListener('orbit:ui-reset', onUiReset);

  console.log('[mode:history] UI initialized (snapshot-first)');
}

/* (опційно для тестів) */
export {
  rebuildCategories as rebuildCategorySelects,
  rebuildObjects   as rebuildObjectsSelect,
  resetHistoryForm
};
