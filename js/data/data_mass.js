// full/js/data/data_mass.js
'use strict';

/**
 * Адаптер даних для режиму «Маса».
 * Еталон «Світність», але для маси (базова одиниця з unit_converter).
 *
 * Експорт:
 *  - getMassData(scope): StandardData
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

// Є валідна маса?
function hasMass(rec) {
  const v = Number(rec?.mass?.value);
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
    // фолбек: шукати по всій переданій бібліотеці (тут це вже відфільтрований src)
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
function findUser(store, { category, name }) {
  if (!store) return null;
  if (typeof store.getByName === 'function') {
    const hit = store.getByName('mass', name, category);
    if (hit) return hit;
  }
  // фолбек через list('mass')
  if (typeof store.list === 'function') {
    const all = store.list('mass') || [];
    const nName = low(name);
    const nCat  = low(category);
    const hit = all.find(o => low(o?.name || o?.name_i18n?.[o?.originalLang]) === nName &&
                              low(o?.category || o?.category_i18n?.[o?.originalLang]) === nCat);
    if (hit) return hit;
  }
  return null;
}

// Конвертація маси → базова одиниця через централізований конвертер
function toBaseMassViaConverter(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;

  const baseU = getBaseUnit('mass');
  const u = (unit && String(unit)) || baseU || baseU;
  try {
    return convertToBase(v, u, 'mass'); // база для 'mass' задається в unit_converter
  } catch {
    return NaN;
  }
}

// Прочитати масу (у базовій одиниці) із офіційного чи юзерського запису
function readMassBase(source) {
  const baseU = getBaseUnit('mass');

  // 1) офіційні: mass { value, unit }
  if (source?.mass && typeof source.mass === 'object') {
    const vb = toBaseMassViaConverter(source.mass.value, source.mass.unit || baseU);
    if (Number.isFinite(vb)) return { valueReal: vb, unit: baseU };
  }

  // 2) юзерські через attrs
  if (source?.attrs?.mass && typeof source.attrs.mass === 'object') {
    const vb = toBaseMassViaConverter(source.attrs.mass.value, source.attrs.mass.unit || baseU);
    if (Number.isFinite(vb)) return { valueReal: vb, unit: baseU };
  }

  // 3) можливі плоскі поля
  if (source && typeof source === 'object') {
    const vb = toBaseMassViaConverter(
      source.massValue ?? source.value ?? source.mass,
      source.massUnit ?? source.unit ?? (source.mass && source.mass.unit) ?? baseU
    );
    if (Number.isFinite(vb)) return { valueReal: vb, unit: baseU };
  }

  return { valueReal: NaN, unit: baseU };
}

// Діаметр базового кола (м)
function readBaselineDiameterMeters(scope) {
  const a = scope?.querySelector('#massCircleObject1, [data-field="baseline-diameter"]');
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
 * Зібрати StandardData для calc та інфопанелі (режим «Маса»).
 * @param {HTMLElement} scope - контейнер підсекції режиму (details#univers_mass)
 */
export function getMassData(scope) {
  const lang  = getCurrentLang?.() || 'ua';
  const lib   = getUniversLibrary();
  const store = getStore();

  // Вибір користувача (строго під панель з префіксом mass*)
  const catO1  = getVal(scope, '#massCategoryObject1');
  const catO2  = getVal(scope, '#massCategoryObject2');
  const nameO1 = getVal(scope, '#massObject1');
  const nameO2 = getVal(scope, '#massObject2');

  // Працюємо тільки з офіційними записами, що мають валідну масу
  const src = Array.isArray(lib) ? lib.filter(hasMass) : [];

  // Офіційні/юзерські об’єкти (офіційні шукаємо лише в src)
  let off1 = findOfficial(src, { category: catO1, name: nameO1 });
  if (!off1 && nameO1) off1 = findOfficial(src, { category: '', name: nameO1 });

  // Юзерський — лише якщо у нього валідна маса
  let user1 = findUser(store, { category: catO1, name: nameO1 });
  if (user1) {
    const test = readMassBase(user1);
    if (!Number.isFinite(test.valueReal) || test.valueReal <= 0) user1 = null;
  }
  const obj1 = off1?.obj || user1;

  let off2 = findOfficial(src, { category: catO2, name: nameO2 });
  if (!off2 && nameO2) off2 = findOfficial(src, { category: '', name: nameO2 });

  let user2 = findUser(store, { category: catO2, name: nameO2 });
  if (user2) {
    const test = readMassBase(user2);
    if (!Number.isFinite(test.valueReal) || test.valueReal <= 0) user2 = null;
  }
  const obj2 = off2?.obj || user2;

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // Локалізовані поля
  const name1 = obj1 ? pickLang(obj1, 'name', lang) : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang) : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang) : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang) : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  const { valueReal: m1b, unit: u1 } = readMassBase(obj1);
  const { valueReal: m2b, unit: u2 } = readMassBase(obj2);

  // Стандартний пакет
  return {
    modeId: 'mass',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'value',
      valueReal: Number.isFinite(m1b) ? m1b : NaN, // у базовій одиниці 'mass'
      unit: u1 || getBaseUnit('mass'),
      diameterScaled: baselineDiameterMeters,
      color: undefined,
      libIndex: off1?.libIndex ?? -1,
      userId: obj1?.id || obj1?._id || undefined
    },
    object2: {
      name: name2,
      category: cat2,
      description: desc2,
      kind: 'value',
      valueReal: Number.isFinite(m2b) ? m2b : NaN, // у базовій одиниці 'mass'
      unit: u2 || getBaseUnit('mass'),
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
