// /js/blocks/geo_population.js
'use strict';

/**
 * Режим «Географія → Населення» (UI) — SNAPSHOT-FIRST, за еталоном «Діаметри».
 * - О1 і О2: категорії/об'єкти з geo-бібліотеки (мердж офіційні + UGC);
 * - для КОЖНОГО <option> прикріплюємо snapshot у dataset.snapshot (population {value,unit} тощо);
 * - відновлення вибору за snapshot.id; локалізовані лейбли, UGC позначається (корист.);
 * - слухаємо reload/ready бібліотек, зміну мови, orbit:ui-reset.
 */

import { t, getCurrentLang } from '../i18n.js';
import { loadGeoLibrary, getGeoLibrary } from '../data/geo_lib.js';
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

function hasValidPopulation(rec) {
  const v = Number(rec?.population?.value);
  return Number.isFinite(v) && v > 0;
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
 * Прикріпити snapshot населення до option (для О1/О2 однаково).
 * Snapshot формат:
 * {
 *   id, category_key,
 *   value, unit,         // population.{value,unit}
 *   name_ua, name_en, name_es,
 *   description_ua, description_en, description_es,
 *   category_ua, category_en, category_es (якщо є)
 * }
 */
function attachPopulationSnapshot(opt, rec) {
  if (!opt || !rec || !hasValidPopulation(rec)) return;
  const p = rec.population;
  const snap = {
    id: rec?.id ?? null,
    category_key: rec?.category_key ?? rec?.category_id ?? null,
    value: Number(p?.value),
    unit:  s(p?.unit),
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
  if (!Number.isFinite(snap.value) || snap.value <= 0 || !snap.unit) return;
  try { opt.dataset.snapshot = JSON.stringify(snap); } catch {}
  if (isUser(rec)) opt.dataset.user = '1';
}

/* ─────────────────────────────────────────────────────────────
   Категорії (спільно для О1/О2)
───────────────────────────────────────────────────────────── */

function rebuildCategories(scope) {
  const lang = currLangBase();
  const lib  = (getGeoLibrary('geo_population') || []).filter(hasValidPopulation);

  const sel1 = scope.querySelector('#geoPopCategoryObject1') || scope.querySelector('.object1-group .category-select');
  const sel2 = scope.querySelector('#geoPopCategoryObject2') || scope.querySelector('.object2-group .category-select');
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
    // Показуємо категорію лише якщо є хоч один об'єкт із локалізованою назвою
    const hasLocalizedObj = rows.some(r => hasValidPopulation(r) && s(r?.[`name_${lang}`]));
    if (!hasLocalizedObj) continue;

    // Підпис категорії
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
  const lib  = (getGeoLibrary('geo_population') || []).filter(hasValidPopulation);

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
    attachPopulationSnapshot(opt, it.rec);
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

function resetGeoPopulationForm(scope) {
  // розблокувати О1
  scope.querySelector('.object1-group')?.classList.remove('is-locked');
  scope.querySelectorAll('.object1-group select, .object1-group input').forEach(el => {
    el.disabled = false;
    el.classList.remove('is-invalid');
  });

  // інпут базового діаметра (масштаб)
  const base = scope.querySelector('#geoPopBaselineDiameter') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) {
    base.placeholder = t('panel_placeholder_input_diameter');
    base.value = '';
  }

  rebuildCategories(scope);
  rebuildObjects(scope, { catSel: '#geoPopCategoryObject1', objSel: '#geoPopObject1', isO1: true });
  rebuildObjects(scope, { catSel: '#geoPopCategoryObject2', objSel: '#geoPopObject2', isO1: false });
}

/* ─────────────────────────────────────────────────────────────
   Ініціалізація
───────────────────────────────────────────────────────────── */

export async function initGeoPopulationBlock() {
  try {
    await loadGeoLibrary('geo_population');
  } catch (e) {
    console.error('[geo_population] library load failed:', e);
  }

  const scope = document.getElementById('geo_population');
  if (!scope) { console.warn('[geo_population] #geo_population not found'); return; }

  // стартове заповнення
  rebuildCategories(scope);
  rebuildObjects(scope, { catSel: '#geoPopCategoryObject1', objSel: '#geoPopObject1', isO1: true });
  rebuildObjects(scope, { catSel: '#geoPopCategoryObject2', objSel: '#geoPopObject2', isO1: false });

  // плейсхолдер і підказки для baseline О1
  const base = scope.querySelector('#geoPopBaselineDiameter') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) {
    base.placeholder = t('panel_placeholder_input_diameter');
    try { attachO1QuickSuggest({ inputEl: base }); } catch {}
  }

  // зміна категорій → оновити список об'єктів у відповідній групі
  scope.querySelector('#geoPopCategoryObject1')?.addEventListener('change', () => {
    rebuildObjects(scope, { catSel: '#geoPopCategoryObject1', objSel: '#geoPopObject1', isO1: true });
  });
  scope.querySelector('#geoPopCategoryObject2')?.addEventListener('change', () => {
    rebuildObjects(scope, { catSel: '#geoPopCategoryObject2', objSel: '#geoPopObject2', isO1: false });
  });

  // перезбірка при оновленні бібліотеки/UGC та зміні мови
  const rebuildAll = () => {
    rebuildCategories(scope);
    rebuildObjects(scope, { catSel: '#geoPopCategoryObject1', objSel: '#geoPopObject1', isO1: true });
    rebuildObjects(scope, { catSel: '#geoPopCategoryObject2', objSel: '#geoPopObject2', isO1: false });
  };

  document.addEventListener('geo-lib-reloaded', rebuildAll);
  document.addEventListener('geo-lib:ready',   rebuildAll);
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
  const onUiReset = () => resetGeoPopulationForm(scope);
  window.addEventListener('orbit:ui-reset', onUiReset);

  console.log('[mode:geo:population] UI initialized (snapshot-first)');
}

/* (опційно для тестів) */
export {
  rebuildCategories as rebuildCategorySelectsGeoPopulation,
  rebuildObjects   as rebuildObjectsSelectGeoPopulation,
  resetGeoPopulationForm
};
