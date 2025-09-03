// full/js/data/data_money.js
'use strict';

/**
 * Еталонний адаптер даних для режиму «Гроші».
 * Завдання:
 *  - прочитати вибір користувача з DOM (у межах контейнера режиму);
 *  - знайти об’єкти в money-бібліотеці або серед юзерських;
 *  - повернути уніфікований пакет StandardData (без мережі, без рендера).
 *
 * Експорт:
 *  - getMoneyData(scope): StandardData
 */

import { getCurrentLang } from '../i18n.js';
import { getMoneyLibrary } from './money_lib.js';
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

// Ключ категорії (узгоджено з blocks/money.js)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
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
    // фолбек: шукати по всій бібліотеці лише за назвою
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
    const hit = store.getByName('money', name, category);
    if (hit) return hit;
  }
  // фолбек через list('money')
  if (typeof store.list === 'function') {
    const all = store.list('money') || [];
    const nName = low(name);
    const nCat  = low(category);
    const hit = all.find(o => low(o?.name || o?.name_i18n?.[o?.originalLang]) === nName &&
                              low(o?.category || o?.category_i18n?.[o?.originalLang]) === nCat);
    if (hit) return hit;
  }
  return null;
}

// Прочитати (value, unit) з офіційного чи юзерського запису
function readMoneyValueUnit(source) {
  // 1) офіційний формат: { money: { value, unit } }
  if (source?.money && typeof source.money === 'object') {
    const v = Number(source.money.value);
    const u = norm(source.money.unit || 'USD');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }

  // 2) юзерський через модалку: attrs.diameter { value, unit }
  if (source?.attrs?.diameter && typeof source.attrs.diameter === 'object') {
    const v = Number(source.attrs.diameter.value);
    const u = norm(source.attrs.diameter.unit || source.unit || source.currency || 'USD');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }

  // 3) інші можливі плоскі поля
  if (source && typeof source === 'object') {
    const v = Number(source.value ?? source.amount ?? source.moneyValue);
    const u = norm(source.unit ?? source.currency ?? (source.money && source.money.unit) ?? 'USD');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }

  return { valueReal: NaN, unit: 'USD' };
}

// Діаметр базового кола (м)
function readBaselineDiameterMeters(scope) {
  const a = scope?.querySelector('#moneyBaselineDiameter, [data-field="baseline-diameter"]');
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
 * Зібрати StandardData для calc та інфопанелі (режим «Гроші»).
 * @param {HTMLElement} scope - контейнер підсекції режиму (details#money)
 */
export function getMoneyData(scope) {
  const lang = getCurrentLang?.() || 'ua';
  const lib = getMoneyLibrary();
  const store = getStore();

  // Вибір користувача
  const catO1  = getVal(scope, '#moneyCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#moneyCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#moneyObject1, .object1-group .object-select');
  const nameO2 = getVal(scope, '#moneyObject2, .object2-group .object-select');

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

  const { valueReal: v1, unit: u1 } = readMoneyValueUnit(obj1);
  const { valueReal: v2, unit: u2 } = readMoneyValueUnit(obj2);

  // Стандартний пакет
  return {
    modeId: 'money',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'value',
      valueReal: Number.isFinite(v1) ? v1 : NaN,
      unit: u1 || 'USD',
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
      valueReal: Number.isFinite(v2) ? v2 : NaN,
      unit: u2 || 'USD',
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
