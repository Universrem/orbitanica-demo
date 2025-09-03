// full/js/data/data_geo_objects.js
'use strict';

/**
 * Адаптер даних для «Географія → Об’єкти (довжина/висота)».
 * Експорт:
 *  - getGeoObjectsData(scope): StandardData
 */

import { getCurrentLang } from '../i18n.js';
import { getGeoLibrary } from './geo_lib.js';
import { getStore } from '../userObjects/api.js';
import { convertToBase, getBaseUnit } from '../utils/unit_converter.js';

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

// ключ категорії (узгоджено з blocks/geo_objects.js)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

// валідне поле length/height?
function hasLinear(rec) {
  const lv = Number(rec?.length?.value);
  const hv = Number(rec?.height?.value);
  return (Number.isFinite(lv) && lv > 0) || (Number.isFinite(hv) && hv > 0);
}

// Конвертація → метри через централізований конвертер
// Конвертація → метри через централізований конвертер
function toMetersViaConverter(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;

  const u = unit || getBaseUnit('distance') || 'm';
  try {
    return convertToBase(v, u, 'distance'); // база distance = метри
  } catch {
    return NaN;
  }
}


// Прочитати довжину/висоту (в метрах) із офіційного чи юзерського запису
function readGeoLinearMeters(source) {
  // 1) офіційні: length або height
  if (source?.length && typeof source.length === 'object') {
    const vm = toMetersViaConverter(source.length.value, source.length.unit || 'm');
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }
  if (source?.height && typeof source.height === 'object') {
    const vm = toMetersViaConverter(source.height.value, source.height.unit || 'm');
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }

  // 2) юзерські через attrs
  if (source?.attrs?.length && typeof source.attrs.length === 'object') {
    const vm = toMetersViaConverter(source.attrs.length.value, source.attrs.length.unit || 'm');
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }
  if (source?.attrs?.height && typeof source.attrs.height === 'object') {
    const vm = toMetersViaConverter(source.attrs.height.value, source.attrs.height.unit || 'm');
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }

  // 3) можливі плоскі поля
  if (source && typeof source === 'object') {
    const vm = toMetersViaConverter(
      source.lengthValue ?? source.heightValue ?? source.value,
      source.lengthUnit ?? source.heightUnit ?? source.unit ?? 'm'
    );
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }

  return { valueReal: NaN, unit: 'm' };
}

// Діаметр базового кола (м)
function readBaselineDiameterMeters(scope) {
  const a = scope?.querySelector('#geoObjBaselineDiameter, [data-field="baseline-diameter"]');
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

export function getGeoObjectsData(scope) {
  const lang = getCurrentLang?.() || 'ua';
  const lib = getGeoLibrary();
  const store = getStore();

  // Вибір користувача
  const catO1  = getVal(scope, '#geoObjCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#geoObjCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#geoObjObject1, .object1-group .object-select');
  const nameO2 = getVal(scope, '#geoObjObject2, .object2-group .object-select');

  // Офіційні/юзерські об’єкти
  const src = Array.isArray(lib) ? lib.filter(hasLinear) : [];
  const findOfficial = ({ category, name }) => {
    const catKey = low(category);
    let rows = src;
    if (catKey) rows = rows.filter(r => getCatKey(r) === catKey);

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
  };

  let off1 = findOfficial({ category: catO1, name: nameO1 });
  if (!off1 && nameO1) off1 = findOfficial({ category: '', name: nameO1 });
  const obj1 = off1?.obj || (getStore()?.getByName?.('geo', nameO1, catO1) ?? null);

  let off2 = findOfficial({ category: catO2, name: nameO2 });
  if (!off2 && nameO2) off2 = findOfficial({ category: '', name: nameO2 });
  const obj2 = off2?.obj || (getStore()?.getByName?.('geo', nameO2, catO2) ?? null);

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // Локалізація
  const name1 = obj1 ? pickLang(obj1, 'name', lang) : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang) : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang) : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang) : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  const { valueReal: l1m, unit: u1 } = readGeoLinearMeters(obj1);
  const { valueReal: l2m, unit: u2 } = readGeoLinearMeters(obj2);

  return {
    modeId: 'geo_objects',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'length',
      valueReal: Number.isFinite(l1m) ? l1m : NaN, // в метрах
      unit: u1 || 'm',
      diameterScaled: baselineDiameterMeters,
      color: undefined,
      libIndex: off1?.libIndex ?? -1,
      userId: obj1?.id || obj1?._id || undefined
    },
    object2: {
      name: name2,
      category: cat2,
      description: desc2,
      kind: 'length',
      valueReal: Number.isFinite(l2m) ? l2m : NaN, // в метрах
      unit: u2 || 'm',
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
