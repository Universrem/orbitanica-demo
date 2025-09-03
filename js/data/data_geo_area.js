// full/js/data/data_geo_area.js
'use strict';

/**
 * Адаптер даних для режиму «Географія → Площа».
 * Експорт:
 *  - getGeoAreaData(scope): StandardData
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

// Ключ категорії (узгоджено з blocks/geo_area.js)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}
// є валідне поле area?
function hasArea(rec) {
  const v = Number(rec?.area?.value);
  return Number.isFinite(v) && v > 0;
}

// Офіційний запис із бібліотеки
function findOfficial(lib, { category, name }) {
  if (!Array.isArray(lib)) return null;

  // базовий пул: лише записи з area
  let rows = lib.filter(hasArea);

  const catKey = low(category);
  if (catKey) {
    rows = rows.filter(rec => getCatKey(rec) === catKey);
  }

  const nameNeedle = low(name);
  if (nameNeedle) {
    // спочатку в межах категорії (якщо була)
    for (let i = 0; i < rows.length; i++) {
      const o = rows[i];
      const n_en = low(o?.name_en);
      const n_ua = low(o?.name_ua);
      const n_es = low(o?.name_es);
      const n    = low(o?.name);
      if ([n_en, n_ua, n_es, n].some(v => v && v === nameNeedle)) {
        const li = lib.indexOf(o);
        return { obj: o, libIndex: li >= 0 ? li : i };
      }
    }
    // фолбек: по ВСІЙ бібліотеці, але теж тільки з area
    const allArea = lib.filter(hasArea);
    for (let i = 0; i < allArea.length; i++) {
      const o = allArea[i];
      const n_en = low(o?.name_en);
      const n_ua = low(o?.name_ua);
      const n_es = low(o?.name_es);
      const n    = low(o?.name);
      if ([n_en, n_ua, n_es, n].some(v => v && v === nameNeedle)) {
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

// Юзерський об’єкт зі стора
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

// Прочитати (value, unit) для ПЛОЩІ
function readGeoAreaValueUnit(source) {
  // 1) офіційний формат: { area: { value, unit } }
  if (source?.area && typeof source.area === 'object') {
    const v = Number(source.area.value);
    const u = norm(source.area.unit || 'km²');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }
  // 2) юзерський через модалку: attrs.area { value, unit }
  if (source?.attrs?.area && typeof source.attrs.area === 'object') {
    const v = Number(source.attrs.area.value);
    const u = norm(source.attrs.area.unit || 'km²');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }
  // 3) інші можливі плоскі поля
  if (source && typeof source === 'object') {
    const v = Number(source.areaValue ?? source.value);
    const u = norm(source.areaUnit ?? source.unit ?? 'km²');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }
  return { valueReal: NaN, unit: 'km²' };
}

// Діаметр базового кола (м)
function readBaselineDiameterMeters(scope) {
  const a = scope?.querySelector('#geoAreaBaselineDiameter, [data-field="baseline-diameter"]');
  if (a) {
    const v = Number(a.value);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return 0;
}

function getVal(scope, sel) {
  const el = scope?.querySelector(sel);
  return el ? norm(el.value) : '';
}

// ─────────────────────────────────────────────────────────────
// Експорт

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Географія → Площа»).
 * @param {HTMLElement} scope - контейнер підсекції режиму (details#geo_area)
 */
export function getGeoAreaData(scope) {
  const lang = getCurrentLang?.() || 'ua';
  const lib = getGeoLibrary();
  const store = getStore();

  // Вибір користувача
  const catO1  = getVal(scope, '#geoAreaCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#geoAreaCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#geoAreaObject1, .object1-group .object-select');
  const nameO2 = getVal(scope, '#geoAreaObject2, .object2-group .object-select');

  // Офіційні/юзерські об’єкти
  let off1 = findOfficial(lib, { category: catO1, name: nameO1 });
  if (!off1 && nameO1) off1 = findOfficial(lib, { category: '', name: nameO1 });
  const obj1 = off1?.obj || findUser(store, { category: catO1, name: nameO1 });

  let off2 = findOfficial(lib, { category: catO2, name: nameO2 });
  if (!off2 && nameO2) off2 = findOfficial(lib, { category: '', name: nameO2 });
  const obj2 = off2?.obj || findUser(store, { category: catO2, name: nameO2 });

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // Локалізовані поля
  const name1 = obj1 ? pickLang(obj1, 'name', lang) : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang) : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang) : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang) : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  const { valueReal: v1, unit: u1 } = readGeoAreaValueUnit(obj1);
  const { valueReal: v2, unit: u2 } = readGeoAreaValueUnit(obj2);

  // Стандартний пакет
  return {
    modeId: 'geo_area',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'area',
      valueReal: Number.isFinite(v1) ? v1 : NaN,
      unit: u1 || 'km²',
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
      unit: u2 || 'km²',
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
