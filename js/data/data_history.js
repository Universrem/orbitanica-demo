// /js/data/data_history.js
'use strict';

/**
 * Еталонний адаптер даних для режиму «Історія».
 * Завдання:
 *  - прочитати вибір користувача з DOM (у межах контейнера режиму);
 *  - знайти події в history-бібліотеці або серед юзерських;
 *  - повернути уніфікований пакет StandardData (без мережі, без рендера).
 *
 * Особливості режиму:
 *  - Масштаб задається ЧЕРЕЗ О1: користувач вводить САМЕ ДІАМЕТР О1-start (м).
 *  - Усі розрахунки виконуються за роками: yearsFromNow = |pivotYear - year|.
 *  - В інфопанелі показуємо РАДІУС, але користувач вводить ДІАМЕТР.
 *
 * Експорт:
 *  - getHistoryData(scope): StandardData
 */

import { getCurrentLang } from '../i18n.js';
import { getHistoryLibrary } from './history_lib.js';
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

// Ключ категорії (узгоджено з blocks/history.js)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

// ─────────────────────────────────────────────────────────────
// Пошук об'єктів

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
    const hit = store.getByName('history', name, category);
    if (hit) return hit;
  }
  // фолбек через list('history')
  if (typeof store.list === 'function') {
    const all = store.list('history') || [];
    const nName = low(name);
    const nCat  = low(category);
    const hit = all.find(o => low(o?.name || o?.name_i18n?.[o?.originalLang]) === nName &&
                              low(o?.category || o?.category_i18n?.[o?.originalLang]) === nCat);
    if (hit) return hit;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Роки та різниця в роках

// Pivot-рік для відліку «від сьогодні».
// Можна перевизначити через window.orbit.historyPivotYear ззовні.
function getPivotYear() {
  try {
    const w = (typeof window !== 'undefined') ? window : {};
    if (w.orbit && Number.isFinite(w.orbit.historyPivotYear)) {
      return Number(w.orbit.historyPivotYear);
    }
  } catch {}
  const now = new Date();
  return now.getFullYear(); // поточний рік як центр
}

function toYearNumber(maybeYearObj) {
  // Очікуємо формат { value, unit: 'year' } або число
  if (maybeYearObj == null) return NaN;
  if (typeof maybeYearObj === 'number') return Number(maybeYearObj);
  if (typeof maybeYearObj === 'string') {
    const v = Number(maybeYearObj);
    return Number.isFinite(v) ? v : NaN;
  }
  if (typeof maybeYearObj === 'object') {
    const v = Number(maybeYearObj.value ?? maybeYearObj.year ?? maybeYearObj.y);
    return Number.isFinite(v) ? v : NaN;
  }
  return NaN;
}

function yearsFromPivot(year, pivot) {
  if (!Number.isFinite(year)) return NaN;
  return Math.abs(pivot - year);
}

// Прочитати (yearStart, yearEnd) з офіційного чи юзерського запису
function readYears(source) {
  // Офіційний формат бібліотеки:
  // time_start: { value: <число>, unit: "year" }, time_end?: { ... }
  let yStart = NaN;
  let yEnd   = NaN;

  if (source && typeof source === 'object') {
    // Офіційні поля
    if (source.time_start) yStart = toYearNumber(source.time_start);
    if (source.time_end)   yEnd   = toYearNumber(source.time_end);

    // Можливі юзерські/плоскі поля
    if (!Number.isFinite(yStart)) {
      yStart = toYearNumber(source.year_start ?? source.start ?? source.year);
    }
    if (!Number.isFinite(yEnd)) {
      yEnd = toYearNumber(source.year_end ?? source.end);
    }

    // Через модалку attrs.*
    if (source.attrs && typeof source.attrs === 'object') {
      if (!Number.isFinite(yStart)) yStart = toYearNumber(source.attrs.time_start ?? source.attrs.year_start);
      if (!Number.isFinite(yEnd))   yEnd   = toYearNumber(source.attrs.time_end   ?? source.attrs.year_end);
    }
  }

  return {
    yearStart: Number.isFinite(yStart) ? yStart : NaN,
    yearEnd:   Number.isFinite(yEnd)   ? yEnd   : NaN
  };
}

// ─────────────────────────────────────────────────────────────
// DOM accessors

function getVal(scope, sel) {
  const el = scope?.querySelector(sel);
  return el ? norm(el.value) : '';
}

// Діаметр базового кола (м), який вводить користувач ДЛЯ О1-start
function readBaselineDiameterMeters(scope) {
  const a = scope?.querySelector('#historyBaselineDiameter');
  if (a) {
    const v = Number(a.value);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────
// Експорт

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Історія»).
 * @param {HTMLElement} scope - контейнер підсекції режиму (details#history)
 * @returns {{
 *   modeId: 'history',
 *   pivotYear: number,
 *   object1: {
 *     name: string, category: string, description: string,
 *     kind: 'event',
 *     yearStart: number|null, yearEnd: number|null,
 *     yearsStart: number|null, yearsEnd: number|null,
 *     unit: 'year',
 *     diameterScaled: number, // введений КОРИСТУВАЧЕМ діаметр О1-start (м)
 *     color?: string,
 *     libIndex: number,
 *     userId?: string
 *   },
 *   object2: {
 *     name: string, category: string, description: string,
 *     kind: 'event',
 *     yearStart: number|null, yearEnd: number|null,
 *     yearsStart: number|null, yearsEnd: number|null,
 *     unit: 'year',
 *     color?: string,
 *     libIndex: number,
 *     userId?: string
 *   }
 * }}
 */
export function getHistoryData(scope) {
  const lang  = getCurrentLang?.() || 'ua';
  const lib   = getHistoryLibrary();
  const store = getStore();
  const pivot = getPivotYear();

  // Вибір користувача (узгоджено з blocks/history.js)
  const catO1  = getVal(scope, '#histCategoryObject1');
  const catO2  = getVal(scope, '#histCategoryObject2');
  const nameO1 = getVal(scope, '#histObject1');
  const nameO2 = getVal(scope, '#histObject2');

  // Офіційні/юзерські об’єкти
  let off1 = findOfficial(lib, { category: catO1, name: nameO1 });
  if (!off1 && nameO1) off1 = findOfficial(lib, { category: '', name: nameO1 });
  const obj1 = off1?.obj || findUser(store, { category: catO1, name: nameO1 });

  let off2 = findOfficial(lib, { category: catO2, name: nameO2 });
  if (!off2 && nameO2) off2 = findOfficial(lib, { category: '', name: nameO2 });
  const obj2 = off2?.obj || findUser(store, { category: catO2, name: nameO2 });

  // Локалізовані поля
  const name1 = obj1 ? pickLang(obj1, 'name', lang) : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang) : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang) : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang) : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  // Роки та відстані у роках від pivot
  const { yearStart: y1s, yearEnd: y1e } = readYears(obj1);
  const { yearStart: y2s, yearEnd: y2e } = readYears(obj2);

  const years1s = Number.isFinite(y1s) ? yearsFromPivot(y1s, pivot) : NaN;
  const years1e = Number.isFinite(y1e) ? yearsFromPivot(y1e, pivot) : NaN;
  const years2s = Number.isFinite(y2s) ? yearsFromPivot(y2s, pivot) : NaN;
  const years2e = Number.isFinite(y2e) ? yearsFromPivot(y2e, pivot) : NaN;

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // Стандартний пакет
  return {
    modeId: 'history',
    pivotYear: pivot,
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'event',
      yearStart: Number.isFinite(y1s) ? y1s : null,
      yearEnd:   Number.isFinite(y1e) ? y1e : null,
      yearsStart: Number.isFinite(years1s) ? years1s : null,
      yearsEnd:   Number.isFinite(years1e) ? years1e : null,
      unit: 'year',
      diameterScaled: baselineDiameterMeters, // ВВЕДЕНИЙ ДІАМЕТР О1-start (м)
      color: undefined,
      libIndex: off1?.libIndex ?? -1,
      userId: obj1?.id || obj1?._id || undefined
    },
    object2: {
      name: name2,
      category: cat2,
      description: desc2,
      kind: 'event',
      yearStart: Number.isFinite(y2s) ? y2s : null,
      yearEnd:   Number.isFinite(y2e) ? y2e : null,
      yearsStart: Number.isFinite(years2s) ? years2s : null,
      yearsEnd:   Number.isFinite(years2e) ? years2e : null,
      unit: 'year',
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
