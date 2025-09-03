// full/js/data/data_distance.js
'use strict';

/**
 * Адаптер даних для режиму «Відстань».
 * Еталон «Світність», але:
 *  - О1: фіксований вибір об’єкта (без категорії), беремо його реальний діаметр;
 *  - О2: беремо distance_to_earth;
 *  - масштаб лінійний: r_scaled = k * distance_to_earth, де k = D1 / realDiameter(O1).
 *
 * Експорт:
 *  - getDistanceData(scope): StandardData
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

// Ключ категорії (узгоджено з blocks)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

// Є валідний діаметр?
function hasDiameter(rec) {
  const v = Number(rec?.diameter?.value);
  return Number.isFinite(v) && v > 0;
}

// Є валідна відстань до Землі?
function hasDistanceToEarth(rec) {
  const v = Number(rec?.distance_to_earth?.value);
  return Number.isFinite(v) && v > 0;
}

// Офіційний запис із бібліотеки: спершу за ключем категорії, потім за назвою (будь-якою мовою)
// Повертає { obj, libIndex } або null
function findOfficial(lib, { category, name }) {
  if (!Array.isArray(lib)) return null;

  const catKey = low(category);
  let rows = lib;

  if (catKey) {
    rows = rows.filter(rec => getCatKey(rec) === catKey);
  }

  const nameNeedle = low(name);
  if (nameNeedle) {
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
    // фолбек: по всій бібліотеці
    for (let i = 0; i < lib.length; i++) {
      const o = lib[i];
      const n_en = low(o?.name_en);
      const n_ua = low(o?.name_ua);
      const n_es = low(o?.name_es);
      const n    = low(o?.name);
      if ([n_en, n_ua, n_es, n].some(v => v && v === nameNeedle)) {
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

// Юзерський об’єкт зі стора (точне співпадіння назви+категорії)
function findUser(store, { type, category, name }) {
  if (!store) return null;
  if (typeof store.getByName === 'function') {
    const hit = store.getByName(type, name, category);
    if (hit) return hit;
  }
  if (typeof store.list === 'function') {
    const all = store.list(type) || [];
    const nName = low(name);
    const nCat  = low(category);
    const hit = all.find(o => low(o?.name || o?.name_i18n?.[o?.originalLang]) === nName &&
                              low(o?.category || o?.category_i18n?.[o?.originalLang]) === nCat);
    if (hit) return hit;
  }
  return null;
}

// Конвертації в базову одиницю відстані (за base_units.json; зараз — км)
const DIST_BASE = getBaseUnit('distance') || 'km';

function toBaseDistance(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;
  const u = (unit && String(unit)) || DIST_BASE;
  try {
    return convertToBase(v, u, 'distance'); // база distance = DIST_BASE
  } catch {
    return NaN;
  }
}

// Прочитати діаметр (у DIST_BASE) з офіційного/юзерського запису
function readDiameterBase(source) {
  if (source?.diameter && typeof source.diameter === 'object') {
    const vb = toBaseDistance(source.diameter.value, source.diameter.unit || DIST_BASE);
    if (Number.isFinite(vb)) return { valueReal: vb, unit: DIST_BASE };
  }
  if (source?.attrs?.diameter && typeof source.attrs.diameter === 'object') {
    const vb = toBaseDistance(source.attrs.diameter.value, source.attrs.diameter.unit || DIST_BASE);
    if (Number.isFinite(vb)) return { valueReal: vb, unit: DIST_BASE };
  }
  if (source && typeof source === 'object') {
    const vb = toBaseDistance(
      source.diameterValue ?? source.value ?? source.diameter,
      source.diameterUnit ?? source.unit ?? (source.diameter && source.diameter.unit) ?? DIST_BASE
    );
    if (Number.isFinite(vb)) return { valueReal: vb, unit: DIST_BASE };
  }
  return { valueReal: NaN, unit: DIST_BASE };
}

// Прочитати distance_to_earth (у DIST_BASE)
function readDistanceToEarthBase(source) {
  if (source?.distance_to_earth && typeof source.distance_to_earth === 'object') {
    const vb = toBaseDistance(source.distance_to_earth.value, source.distance_to_earth.unit || DIST_BASE);
    if (Number.isFinite(vb)) return { valueReal: vb, unit: DIST_BASE };
  }
  if (source?.attrs?.distance_to_earth && typeof source.attrs.distance_to_earth === 'object') {
    const vb = toBaseDistance(source.attrs.distance_to_earth.value, source.attrs.distance_to_earth.unit || DIST_BASE);
    if (Number.isFinite(vb)) return { valueReal: vb, unit: DIST_BASE };
  }
  if (source && typeof source === 'object') {
    const vb = toBaseDistance(
      source.distanceToEarth ?? source.distance ?? source.value,
      source.distanceUnit ?? source.unit ?? (source.distance_to_earth && source.distance_to_earth.unit) ?? DIST_BASE
    );
    if (Number.isFinite(vb)) return { valueReal: vb, unit: DIST_BASE };
  }
  return { valueReal: NaN, unit: DIST_BASE };
}

// Діаметр базового кола (м)
function readBaselineDiameterMeters(scope) {
  const a = scope?.querySelector('#distCircleObject1, [data-field="baseline-diameter"]');
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
 * Зібрати StandardData для calc та інфопанелі (режим «Відстань»).
 * @param {HTMLElement} scope - контейнер підсекції режиму (details#univers_distance)
 */
export function getDistanceData(scope) {
  const lang  = getCurrentLang?.() || 'ua';
  const lib   = getUniversLibrary();
  const store = getStore();

  // Вибір користувача:
  // О1 — лише назва (без категорії); О2 — категорія + назва
  const nameO1 = getVal(scope, '#distObject1');
  const catO2  = getVal(scope, '#distCategoryObject2');
  const nameO2 = getVal(scope, '#distObject2');

  // Офіційні/юзерські об’єкти
  // О1: шукаємо лише офіційний запис із валідним діаметром
  const srcAll = Array.isArray(lib) ? lib : [];
  let off1 = findOfficial(srcAll.filter(hasDiameter), { category: '', name: nameO1 });
  const obj1 = off1?.obj || null; // О1 тільки з бібліотеки

  // О2: тільки ті, де є distance_to_earth
  const src2 = srcAll.filter(hasDistanceToEarth);
  let off2 = findOfficial(src2, { category: catO2, name: nameO2 });
  if (!off2 && nameO2) off2 = findOfficial(src2, { category: '', name: nameO2 });

  // Юзерський О2 допустимо, якщо має валідний distance_to_earth
  let user2 = findUser(store, { type: 'distance', category: catO2, name: nameO2 });
  if (user2) {
    const test = readDistanceToEarthBase(user2);
    if (!Number.isFinite(test.valueReal) || test.valueReal <= 0) user2 = null;
  }
  const obj2 = off2?.obj || user2;

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // Локалізовані поля
  const name1 = obj1 ? pickLang(obj1, 'name', lang) : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang) : ''; // для О1 категорії нема в UI
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang) : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang) : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  // Значення у базових одиницях distance (DIST_BASE, зараз 'km')
  const { valueReal: d1Base, unit: u1 } = readDiameterBase(obj1);          // реальний діаметр О1 (у км)
  const { valueReal: distBase, unit: u2 } = readDistanceToEarthBase(obj2); // відстань О2 до Землі (у км)

  return {
    modeId: 'distance',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'value',
      valueReal: Number.isFinite(d1Base) ? d1Base : NaN, // діаметр О1 у DIST_BASE
      unit: u1 || DIST_BASE,
      diameterScaled: baselineDiameterMeters,            // базовий діаметр кола на мапі (м)
      color: undefined,
      libIndex: off1?.libIndex ?? -1,
      userId: undefined
    },
    object2: {
      name: name2,
      category: cat2,
      description: desc2,
      kind: 'value',
      valueReal: Number.isFinite(distBase) ? distBase : NaN, // distance_to_earth у DIST_BASE
      unit: u2 || DIST_BASE,
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
