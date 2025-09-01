// full/js/data/data_luminosity.js
'use strict';

/**
 * Адаптер даних для режиму «Світність».
 * Еталон «Гроші», але для світності (Вт).
 *
 * Експорт:
 *  - getLuminosityData(scope): StandardData
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

// Є валідна світність?
function hasLuminosity(rec) {
  const v = Number(rec?.luminosity?.value);
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
    const hit = store.getByName('luminosity', name, category);
    if (hit) return hit;
  }
  // фолбек через list('luminosity')
  if (typeof store.list === 'function') {
    const all = store.list('luminosity') || [];
    const nName = low(name);
    const nCat  = low(category);
    const hit = all.find(o => low(o?.name || o?.name_i18n?.[o?.originalLang]) === nName &&
                              low(o?.category || o?.category_i18n?.[o?.originalLang]) === nCat);
    if (hit) return hit;
  }
  return null;
}

// Конвертація світності → Вт через централізований конвертер
function toWattsViaConverter(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;

  const u = (unit && String(unit)) || getBaseUnit('luminosity') || getBaseUnit('luminosity');
  try {
    return convertToBase(v, u, 'luminosity'); // база luminosity = Вт
  } catch {
    return NaN;
  }
}

// Прочитати світність (у Вт) із офіційного чи юзерського запису
function readLuminosityWatts(source) {
  // 1) офіційні: luminosity { value, unit }
  if (source?.luminosity && typeof source.luminosity === 'object') {
    const vw = toWattsViaConverter(source.luminosity.value, source.luminosity.unit || getBaseUnit('luminosity'));
    if (Number.isFinite(vw)) return { valueReal: vw, unit: getBaseUnit('luminosity') };
  }

  // 2) юзерські через attrs
  if (source?.attrs?.luminosity && typeof source.attrs.luminosity === 'object') {
    const vw = toWattsViaConverter(source.attrs.luminosity.value, source.attrs.luminosity.unit || getBaseUnit('luminosity'));
    if (Number.isFinite(vw)) return { valueReal: vw, unit: getBaseUnit('luminosity') };
  }

  // 3) можливі плоскі поля
  if (source && typeof source === 'object') {
    const vw = toWattsViaConverter(
      source.luminosityValue ?? source.value ?? source.luminosity,
      source.luminosityUnit ?? source.unit ?? (source.luminosity && source.luminosity.unit) ?? getBaseUnit('luminosity')
    );
    if (Number.isFinite(vw)) return { valueReal: vw, unit: getBaseUnit('luminosity') };
  }

  return { valueReal: NaN, unit: getBaseUnit('luminosity') };
}

// Діаметр базового кола (м)
function readBaselineDiameterMeters(scope) {
  const a = scope?.querySelector('#lumiCircleObject1, [data-field="baseline-diameter"]');
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
 * Зібрати StandardData для calc та інфопанелі (режим «Світність»).
 * @param {HTMLElement} scope - контейнер підсекції режиму (details#univers_luminosity)
 */
export function getLuminosityData(scope) {
  const lang = getCurrentLang?.() || 'ua';
  const lib = getUniversLibrary();
  const store = getStore();

  // Вибір користувача (строго під панель з префіксом lumi*)
  const catO1  = getVal(scope, '#lumiCategoryObject1');
  const catO2  = getVal(scope, '#lumiCategoryObject2');
  const nameO1 = getVal(scope, '#lumiObject1');
  const nameO2 = getVal(scope, '#lumiObject2');

  // Працюємо тільки з офіційними записами, що мають валідну світність
  const src = Array.isArray(lib) ? lib.filter(hasLuminosity) : [];

  // Офіційні/юзерські об’єкти (офіційні шукаємо лише в src)
  let off1 = findOfficial(src, { category: catO1, name: nameO1 });
  if (!off1 && nameO1) off1 = findOfficial(src, { category: '', name: nameO1 });

  // Юзерський — лише якщо у нього валідна світність
  let user1 = findUser(store, { category: catO1, name: nameO1 });
  if (user1) {
    const test = readLuminosityWatts(user1);
    if (!Number.isFinite(test.valueReal) || test.valueReal <= 0) user1 = null;
  }
  const obj1 = off1?.obj || user1;

  let off2 = findOfficial(src, { category: catO2, name: nameO2 });
  if (!off2 && nameO2) off2 = findOfficial(src, { category: '', name: nameO2 });

  let user2 = findUser(store, { category: catO2, name: nameO2 });
  if (user2) {
    const test = readLuminosityWatts(user2);
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

  const { valueReal: l1w, unit: u1 } = readLuminosityWatts(obj1);
  const { valueReal: l2w, unit: u2 } = readLuminosityWatts(obj2);

  // Стандартний пакет
  return {
    modeId: 'luminosity',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'value',
      valueReal: Number.isFinite(l1w) ? l1w : NaN, // у Вт
      unit: u1 || getBaseUnit('luminosity'),
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
      valueReal: Number.isFinite(l2w) ? l2w : NaN, // у Вт
      unit: u2 || getBaseUnit('luminosity'),
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
