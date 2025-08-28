// full/js/data/data_geo_population.js
'use strict';

/**
 * Адаптер даних для режиму «Географія → Населення».
 * Експорт:
 *  - getGeoPopulationData(scope): StandardData
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

// Ключ категорії (узгоджено з blocks/geo_population.js)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

// є валідне поле population?
function hasPopulation(rec) {
  const v = Number(rec?.population?.value);
  return Number.isFinite(v) && v > 0;
}

// Офіційний запис: тільки серед тих, що мають population
function findOfficial(lib, { category, name }) {
  if (!Array.isArray(lib)) return null;

  let rows = lib.filter(hasPopulation);

  const catKey = low(category);
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
    const all = lib.filter(hasPopulation);
    for (let i = 0; i < all.length; i++) {
      const o = all[i];
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

// Прочитати (value, unit) для населення
function readGeoPopulationValueUnit(source) {
  // 1) офіційний формат: { population: { value, unit } }
  if (source?.population && typeof source.population === 'object') {
    const v = Number(source.population.value);
    const u = norm(source.population.unit || 'people');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }
  // 2) юзерський через модалку: attrs.population { value, unit }
  if (source?.attrs?.population && typeof source.attrs.population === 'object') {
    const v = Number(source.attrs.population.value);
    const u = norm(source.attrs.population.unit || 'people');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }
  // 3) інші можливі плоскі поля
  if (source && typeof source === 'object') {
    const v = Number(source.populationValue ?? source.value);
    const u = norm(source.populationUnit ?? source.unit ?? 'people');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }
  return { valueReal: NaN, unit: 'people' };
}

// Діаметр базового кола (м)
function readBaselineDiameterMeters(scope) {
  const a = scope?.querySelector('#geoPopBaselineDiameter, [data-field="baseline-diameter"]');
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

export function getGeoPopulationData(scope) {
  const lang = getCurrentLang?.() || 'ua';
  const lib = getGeoLibrary();
  const store = getStore();

  // Вибір користувача
  const catO1  = getVal(scope, '#geoPopCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#geoPopCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#geoPopObject1, .object1-group .object-select');
  const nameO2 = getVal(scope, '#geoPopObject2, .object2-group .object-select');

  // Офіційні/юзерські об’єкти
  let off1 = findOfficial(lib, { category: catO1, name: nameO1 });
  if (!off1 && nameO1) off1 = findOfficial(lib, { category: '', name: nameO1 });
  const obj1 = off1?.obj || findUser(store, { category: catO1, name: nameO1 });

  let off2 = findOfficial(lib, { category: catO2, name: nameO2 });
  if (!off2 && nameO2) off2 = findOfficial(lib, { category: '', name: nameO2 });
  const obj2 = off2?.obj || findUser(store, { category: catO2, name: nameO2 });

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // Локалізація
  const name1 = obj1 ? pickLang(obj1, 'name', lang) : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang) : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang) : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang) : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  const { valueReal: v1, unit: u1 } = readGeoPopulationValueUnit(obj1);
  const { valueReal: v2, unit: u2 } = readGeoPopulationValueUnit(obj2);

  return {
    modeId: 'geo_population',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'population',
      valueReal: Number.isFinite(v1) ? v1 : NaN,
      unit: u1 || 'people',
      diameterScaled: baselineDiameterMeters,
      color: undefined,
      libIndex: off1?.libIndex ?? -1,
      userId: obj1?.id || obj1?._id || undefined
    },
    object2: {
      name: name2,
      category: cat2,
      description: desc2,
      kind: 'population',
      valueReal: Number.isFinite(v2) ? v2 : NaN,
      unit: u2 || 'people',
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
