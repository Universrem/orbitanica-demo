// full/js/data/data_geo_area.js
'use strict';

/**
 * Адаптер даних для режиму «Географія → Площа».
 * SNAPSHOT-FIRST для О1 і О2:
 *  - читаємо snapshot із dataset вибраного <option>;
 *  - якщо є — використовуємо його (БЕЗ пошуків);
 *  - якщо немає — фолбек у geo-бібліотеку / юзерський стор.
 *
 * Експорт:
 *  - getGeoAreaData(scope?): StandardData
 */

import { getCurrentLang } from '../i18n.js';
import { getGeoLibrary } from './geo_lib.js';
import { getStore } from '../userObjects/api.js';

// ─────────────────────────────────────────────────────────────
// Утіліти

const norm = s => String(s ?? '').trim();
const low  = s => norm(s).toLowerCase();

function pickLang(rec, base, lang) {
  if (!rec) return '';
  const a = rec[`${base}_${lang}`];
  const b = rec[`${base}_en`];
  const c = rec[`${base}_ua`];
  const d = rec[`${base}_es`];
  const e = rec[base];
  return norm(a || b || c || d || e || '');
}

function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

function hasArea(rec) {
  const v = Number(rec?.area?.value);
  return Number.isFinite(v) && v > 0 && !!norm(rec?.area?.unit);
}

// читання (значення, юніт) площі з різних форматів запису
function readAreaValueUnit(source) {
  // офіційний/нормалізований формат
  if (source?.area && typeof source.area === 'object') {
    const v = Number(source.area.value);
    const u = norm(source.area.unit);
    if (Number.isFinite(v) && v > 0 && u) return { valueReal: v, unit: u };
  }
  // юзерський через attrs
  if (source?.attrs?.area && typeof source.attrs.area === 'object') {
    const v = Number(source.attrs.area.value);
    const u = norm(source.attrs.area.unit);
    if (Number.isFinite(v) && v > 0 && u) return { valueReal: v, unit: u };
  }
  // плоскі поля (сумісність)
  if (source && typeof source === 'object') {
    const v = Number(source.areaValue ?? source.value);
    const u = norm(source.areaUnit ?? source.unit);
    if (Number.isFinite(v) && v > 0 && u) return { valueReal: v, unit: u };
  }
  return { valueReal: NaN, unit: undefined };
}

// базовий діаметр масштабу (м)
function readBaselineDiameterMeters(scope) {
  const root = scope || document;
  const a = root?.querySelector('#geoAreaBaselineDiameter, [data-field="baseline-diameter"]');
  if (a) {
    const v = Number(a.value);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return 0;
}

function getVal(scope, sel) {
  const el = (scope || document)?.querySelector(sel);
  return el ? norm(el.value) : '';
}

// ─────────────────────────────────────────────────────────────
// Пошук у бібліотеці / сторі (фолбек, якщо snapshot відсутній)

function findOfficial(lib, { category, name }) {
  if (!Array.isArray(lib)) return null;

  const src = lib.filter(hasArea);

  const catKey = low(category);
  let rows = src;
  if (catKey) rows = rows.filter(rec => getCatKey(rec) === catKey);

  const needle = low(name);
  if (needle) {
    for (let i = 0; i < rows.length; i++) {
      const o = rows[i];
      const n_en = low(o?.name_en);
      const n_ua = low(o?.name_ua);
      const n_es = low(o?.name_es);
      const n    = low(o?.name);
      if ([n_en, n_ua, n_es, n].some(v => v && v === needle)) {
        const li = lib.indexOf(o);
        return { obj: o, libIndex: li >= 0 ? li : i };
      }
    }
    for (let i = 0; i < src.length; i++) {
      const o = src[i];
      const n_en = low(o?.name_en);
      const n_ua = low(o?.name_ua);
      const n_es = low(o?.name_es);
      const n    = low(o?.name);
      if ([n_en, n_ua, n_es, n].some(v => v && v === needle)) {
        return { obj: o, libIndex: lib.indexOf(o) };
      }
    }
    return null;
  }

  if (rows.length > 0) {
    const o = rows[0];
    const li = lib.indexOf(o);
    return { obj: o, libIndex: li >= 0 ? li : 0 };
  }
  return null;
}

function findUser(store, { category, name }) {
  if (!store) return null;

  if (typeof store.getByName === 'function') {
    const hit = store.getByName('geo', name, category);
    if (hit) return hit;
  }
  if (typeof store.list === 'function') {
    const all = store.list('geo') || [];
    const nName = low(name);
    const nCat  = low(category);
    const hit = all.find(o =>
      low(o?.name || o?.name_i18n?.[o?.originalLang]) === nName &&
      low(o?.category || o?.category_i18n?.[o?.originalLang]) === nCat
    );
    if (hit) return hit;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// SNAPSHOT-FIRST (dataset.snapshot на вибраному <option>)

function getSelectedOption(scope, selectId) {
  const root = scope || document;
  const sel = root?.querySelector(`#${selectId}`);
  if (!sel || sel.tagName !== 'SELECT') return null;
  const idx = sel.selectedIndex;
  if (idx < 0) return null;
  return sel.options[idx] || null;
}

function parseOptionSnapshot(opt) {
  try {
    const raw = opt?.dataset?.snapshot;
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;

    const v = Number(s.value);
    const u = s.unit ? String(s.unit) : '';
    if (!Number.isFinite(v) || v <= 0 || !u) return null;

    return s;
  } catch { return null; }
}

/**
 * Нормалізуємо snapshot у «бібліотечний» запис.
 * Для площі пишемо у поле `area { value, unit }`.
 * category_id беремо з snapshot.category_key або із селекта.
 */
function normalizeSnapshotToLibRecord(snapshot, catKeyFromSelect) {
  if (!snapshot) return null;
  const rec = {
    id: snapshot.id || null,
    source: 'user',
    is_user_object: true,

    name_ua: snapshot.name_ua ?? null,
    name_en: snapshot.name_en ?? null,
    name_es: snapshot.name_es ?? null,
    name:    snapshot.name_en || snapshot.name_ua || snapshot.name_es || '',

    category_id: snapshot.category_key || catKeyFromSelect || null,
    category_en: snapshot.category_en ?? null,
    category_ua: snapshot.category_ua ?? null,
    category_es: snapshot.category_es ?? null,
    category:    snapshot.category_en || snapshot.category_ua || snapshot.category_es || null,

    area: {
      value: Number(snapshot.value),
      unit:  String(snapshot.unit)
    },

    description_ua: snapshot.description_ua ?? null,
    description_en: snapshot.description_en ?? null,
    description_es: snapshot.description_es ?? null
  };

  if (!Number.isFinite(rec.area.value) || rec.area.value <= 0 || !rec.area.unit) return null;
  return rec;
}

function readO1FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'geoAreaObject1');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  const catKeySelect = getVal(scope, '#geoAreaCategoryObject1, .object1-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

function readO2FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'geoAreaObject2');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  const catKeySelect = getVal(scope, '#geoAreaCategoryObject2, .object2-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

// ─────────────────────────────────────────────────────────────
// Експорт

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Гео → Площа»).
 * @param {HTMLElement} [scope]
 */
export function getGeoAreaData(scope) {
  const lang  = getCurrentLang?.() || 'ua';
  const lib   = getGeoLibrary();
  const store = getStore();

  // вибір користувача
  const catO1  = getVal(scope, '#geoAreaCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#geoAreaCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#geoAreaObject1,         .object1-group .object-select');
  const nameO2 = getVal(scope, '#geoAreaObject2,         .object2-group .object-select');

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // SNAPSHOT-FIRST
  let obj1 = readO1FromSnapshot(scope);
  let obj2 = readO2FromSnapshot(scope);

  // Фолбеки (бібліотека → стор), якщо snapshot відсутній
  let off1 = null, off2 = null;

  if (!obj1) {
    off1 = findOfficial(lib, { category: catO1, name: nameO1 }) || (nameO1 && findOfficial(lib, { category: '', name: nameO1 }));
    obj1 = off1?.obj || findUser(store, { category: catO1, name: nameO1 }) || null;
  }
  if (!obj2) {
    off2 = findOfficial(lib, { category: catO2, name: nameO2 }) || (nameO2 && findOfficial(lib, { category: '', name: nameO2 }));
    obj2 = off2?.obj || findUser(store, { category: catO2, name: nameO2 }) || null;
  }

  // локалізація
  const name1 = obj1 ? pickLang(obj1, 'name', lang)        : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang)    : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang)        : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang)    : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  // значення
  const { valueReal: v1, unit: u1 } = readAreaValueUnit(obj1);
  const { valueReal: v2, unit: u2 } = readAreaValueUnit(obj2);

  // стандартний пакет
  return {
    modeId: 'geo_area',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'area',
      valueReal: Number.isFinite(v1) ? v1 : NaN,
      unit: u1,                           // без дефолтів
      diameterScaled: baselineDiameterMeters,
      color: undefined,
      libIndex: off1?.libIndex ?? -1,
      userId: obj1?.id || obj1?._id || undefined
    },
    object2: {
      name: name2,
      category: cat2,
      description: desc2,
      kind: 'area',
      valueReal: Number.isFinite(v2) ? v2 : NaN,
      unit: u2,                           // без дефолтів
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
