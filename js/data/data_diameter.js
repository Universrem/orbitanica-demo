// full/js/data/data_diameter.js
'use strict';

/**
 * Адаптер даних для режиму «Діаметр» (еталон «Гроші»).
 * Завдання:
 *  - прочитати вибір користувача з DOM (контейнер режиму);
 *  - знайти об’єкти у univers-бібліотеці або серед юзерських;
 *  - привести діаметри до метрів через централізований конвертер;
 *  - повернути StandardData (без мережі і без рендера).
 *
 * Експорт:
 *  - getDiameterData(scope?): StandardData
 */

import { getCurrentLang } from '../i18n.js';
import { getUniversLibrary } from './univers_lib.js';
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

// ключ категорії (узгоджено з блоками)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

// конвертація довжини → метри через централізований конвертер
function toMetersViaConverter(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;
  const u = (unit && String(unit)) || getBaseUnit('diameter') || 'km';
  try {
    // convertToBase для 'diameter' уже повертає значення в МЕТРАХ у вашій реалізації
    return convertToBase(v, u, 'diameter');
  } catch {
    return NaN;
  }
}



// Прочитати діаметр у метрах з офіційного чи юзерського запису
function readDiameterMeters(source) {
  // 1) офіційний формат univers: { diameter: { value, unit } }
  if (source?.diameter && typeof source.diameter === 'object') {
    const rawUnit = String(source.diameter.unit || 'km').trim();
    const vm = toMetersViaConverter(source.diameter.value, rawUnit);
    if (Number.isFinite(vm)) return { valueReal: vm, unit: rawUnit };
  }

  // 2) юзерський через модалку: attrs.diameter { value, unit }
  if (source?.attrs?.diameter && typeof source.attrs.diameter === 'object') {
    const rawUnit = String(source.attrs.diameter.unit || source.unit || 'km').trim();
    const vm = toMetersViaConverter(source.attrs.diameter.value, rawUnit);
    if (Number.isFinite(vm)) return { valueReal: vm, unit: rawUnit };
  }

  // 3) можливі плоскі поля (сумісність)
  if (source && typeof source === 'object') {
    const rawUnit = String(
      (source.diameterUnit ?? source.unit ?? (source.diameter && source.diameter.unit) ?? 'km')
    ).trim();
    const vm = toMetersViaConverter(
      source.diameterValue ?? source.value ?? source.diameter,
      rawUnit
    );
    if (Number.isFinite(vm)) return { valueReal: vm, unit: rawUnit };
  }

  return { valueReal: NaN, unit: 'km' };
}


// Діаметр базового кола О1 (м)
function readBaselineDiameterMeters(scope) {
  const root = scope || document;
  const a = root?.querySelector('#diamCircleObject1, [data-field="baseline-diameter"]');
  if (a) {
    const v = Number(a.value);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return 0;
}

function getVal(scope, sel) {
  const root = scope || document;
  const el = root?.querySelector(sel);
  return el ? norm(el.value) : '';
}

// офіційний запис у бібліотеці: спершу звузити по категорії, потім шукати за назвою (будь-якою мовою)
// повертає { obj, libIndex } або null
function findOfficial(lib, { category, name }) {
  if (!Array.isArray(lib)) return null;

  const catKey = low(category);
  let rows = lib;
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
    // фолбек: шукати по всій бібліотеці лише за назвою
    for (let i = 0; i < lib.length; i++) {
      const o = lib[i];
      const n_en = low(o?.name_en);
      const n_ua = low(o?.name_ua);
      const n_es = low(o?.name_es);
      const n    = low(o?.name);
      if ([n_en, n_ua, n_es, n].some(v => v && v === needle)) {
        return { obj: o, libIndex: i };
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

// юзерський об’єкт зі стора (точне співпадіння назви+категорії) з фолбеком
function findUser(store, { category, name }) {
  if (!store) return null;

  // пріоритетно — getByName('diameter', ...)
  if (typeof store.getByName === 'function') {
    const hit = store.getByName('diameter', name, category);
    if (hit) return hit;
  }
  // фолбек через list('diameter')
  if (typeof store.list === 'function') {
    const all = store.list('diameter') || [];
    const nName = low(name);
    const nCat  = low(category);
    const hit = all.find(o => low(o?.name || o?.name_i18n?.[o?.originalLang]) === nName &&
                              low(o?.category || o?.category_i18n?.[o?.originalLang]) === nCat);
    if (hit) return hit;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Експорт

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Діаметр»).
 * @param {HTMLElement} [scope] - опційно: контейнер підсекції режиму (details#univers_diameter)
 */
export function getDiameterData(scope) {
  const lang  = getCurrentLang?.() || 'ua';
  const lib   = getUniversLibrary();
  const store = getStore();

  // вибір користувача (підтримуємо і #id, і класи-групи як в еталоні)
  const catO1  = getVal(scope, '#diamCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#diamCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#diamObject1,         .object1-group .object-select');
  const nameO2 = getVal(scope, '#diamObject2,         .object2-group .object-select');

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // офіційні/юзерські об’єкти
  let off1 = findOfficial(lib, { category: catO1, name: nameO1 });
  if (!off1 && nameO1) off1 = findOfficial(lib, { category: '', name: nameO1 });
  const obj1 = off1?.obj || findUser(store, { category: catO1, name: nameO1 });

  let off2 = findOfficial(lib, { category: catO2, name: nameO2 });
  if (!off2 && nameO2) off2 = findOfficial(lib, { category: '', name: nameO2 });
  const obj2 = off2?.obj || findUser(store, { category: catO2, name: nameO2 });

  // локалізація
  const name1 = obj1 ? pickLang(obj1, 'name', lang)        : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang)    : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang)        : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang)    : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  // значення у метрах
  const { valueReal: d1m, unit: u1 } = readDiameterMeters(obj1);
  const { valueReal: d2m, unit: u2 } = readDiameterMeters(obj2);

  // стандартний пакет
  return {
    modeId: 'diameter',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'object',
      diameterReal: Number.isFinite(d1m) ? d1m : NaN, // у метрах
      unit: u1 || 'm',
      diameterScaled: baselineDiameterMeters,          // базовий діаметр О1 (м)
      color: undefined,
      libIndex: off1?.libIndex ?? -1,
      userId: obj1?.id || obj1?._id || undefined
    },
    object2: {
      name: name2,
      category: cat2,
      description: desc2,
      kind: 'object',
      diameterReal: Number.isFinite(d2m) ? d2m : NaN, // у метрах
      unit: u2 || 'm',
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
