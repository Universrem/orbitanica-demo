// /js/data/data_history.js
'use strict';

/**
 * Адаптер даних для режиму «Історія».
 * SNAPSHOT-FIRST для О1 і О2 — строго за еталоном data_geo_population.js:
 *  - читаємо snapshot із dataset вибраного <option>;
 *  - якщо є — використовуємо його (БЕЗ пошуків);
 *  - якщо немає — фолбек у history-бібліотеку / юзерський стор.
 *
 * Особливості режиму:
 *  - Масштаб задається ЧЕРЕЗ О1: користувач вводить ДІАМЕТР О1-start (м);
 *  - Розрахунки в роках: years = |pivotYear - year|;
 *  - В інфопанелі показуємо РАДІУС, але користувач вводить ДІАМЕТР.
 *
 * Експорт:
 *  - getHistoryData(scope?): StandardData
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

function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

// Pivot-рік (може бути перевизначений ззовні: window.orbit.historyPivotYear)
function getPivotYear() {
  try {
    const w = (typeof window !== 'undefined') ? window : {};
    if (w.orbit && Number.isFinite(w.orbit.historyPivotYear)) {
      return Number(w.orbit.historyPivotYear);
    }
  } catch {}
  return (new Date()).getFullYear();
}

function toYearNumber(maybeYearObj) {
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
  let yStart = NaN;
  let yEnd   = NaN;

  if (source && typeof source === 'object') {
    // Офіційні поля
    if (source.time_start) yStart = toYearNumber(source.time_start);
    if (source.time_end)   yEnd   = toYearNumber(source.time_end);

    // Можливі плоскі/юзерські поля
    if (!Number.isFinite(yStart)) yStart = toYearNumber(source.year_start ?? source.start ?? source.year);
    if (!Number.isFinite(yEnd))   yEnd   = toYearNumber(source.year_end   ?? source.end);

    // Через attrs.*
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

// Базовий радіус масштабу О1-start (м) — читаємо радіус з UI, повертаємо діаметр
function readBaselineDiameterMeters(scope) {
  const root = scope || document;
  const a = root?.querySelector('#historyBaselineDiameter, [data-field="baseline-diameter"]');
  if (a) {
    const v = Number(a.value);
    if (Number.isFinite(v) && v >= 0) return v * 2;
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

function findUser(store, { category, name }) {
  if (!store) return null;

  if (typeof store.getByName === 'function') {
    const hit = store.getByName('history', name, category);
    if (hit) return hit;
  }
  if (typeof store.list === 'function') {
    const all = store.list('history') || [];
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

/** Перевірка snapshot для історії:
 *  - value (start) — число; unit/unit_key 'year' або відсутній (допускаємо сумісність);
 *  - value2/unit2_key (end) — опційно, якщо є — число; unit 'year' або відсутній.
 */
function parseOptionSnapshot(opt) {
  try {
    const raw = opt?.dataset?.snapshot;
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;

    const v1 = Number(s.value ?? s.year ?? s.time_start?.value);
    if (!Number.isFinite(v1)) return null;

    const u1 = String(s.unit ?? s.unit_key ?? s.time_start?.unit ?? '').trim().toLowerCase();
    if (u1 && u1 !== 'year' && u1 !== 'years') return null;

    const v2 = s.value2 ?? s.year_end ?? s.time_end?.value;
    const endOk = (v2 == null) || Number.isFinite(Number(v2));
    if (!endOk) return null;

    const u2 = String(s.unit2_key ?? s.time_end?.unit ?? '').trim().toLowerCase();
    if (v2 != null && u2 && u2 !== 'year' && u2 !== 'years') return null;

    return s;
  } catch { return null; }
}

/**
 * Нормалізуємо snapshot у «бібліотечний» запис для історії:
 *  - time_start: { value: <start>, unit: 'year' }
 *  - time_end?:  { value: <end>,   unit: 'year' }
 *  - копіюємо name_*, category_*, description_* для локалізації
 */
function normalizeSnapshotToLibRecord(snapshot, catKeyFromSelect) {
  if (!snapshot) return null;

  const startV = Number(snapshot.value ?? snapshot.year ?? snapshot.time_start?.value);
  if (!Number.isFinite(startV)) return null;

  const endRaw = snapshot.value2 ?? snapshot.year_end ?? snapshot.time_end?.value;
  const endV = Number(endRaw);
  const hasEnd = Number.isFinite(endV);

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

    time_start: { value: startV, unit: 'year' },
    description_ua: snapshot.description_ua ?? null,
    description_en: snapshot.description_en ?? null,
    description_es: snapshot.description_es ?? null
  };

  if (hasEnd) {
    rec.time_end = { value: endV, unit: 'year' };
  }

  return rec;
}

function readO1FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'histObject1');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  const catKeySelect = getVal(scope, '#histCategoryObject1, .object1-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

function readO2FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'histObject2');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  const catKeySelect = getVal(scope, '#histCategoryObject2, .object2-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

// ─────────────────────────────────────────────────────────────
// Експорт

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Історія»).
 * @param {HTMLElement} [scope]
 * @returns {{
 *   modeId: 'history',
 *   pivotYear: number,
 *   object1: {
 *     name: string, category: string, description: string,
 *     kind: 'event',
 *     yearStart: number|null, yearEnd: number|null,
 *     yearsStart: number|null, yearsEnd: number|null,
 *     unit: 'year',
 *     diameterScaled: number,
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
  const catO1  = getVal(scope, '#histCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#histCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#histObject1,         .object1-group .object-select');
  const nameO2 = getVal(scope, '#histObject2,         .object2-group .object-select');

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

  // Локалізація
  const name1 = obj1 ? pickLang(obj1, 'name', lang)        : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang)    : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang)        : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang)    : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  // Роки та відстані у роках від pivot
  const { yearStart: y1s, yearEnd: y1e } = readYears(obj1);
  const { yearStart: y2s, yearEnd: y2e } = readYears(obj2);

  const years1s = Number.isFinite(y1s) ? yearsFromPivot(y1s, pivot) : NaN;
  const years1e = Number.isFinite(y1e) ? yearsFromPivot(y1e, pivot) : NaN;
  const years2s = Number.isFinite(y2s) ? yearsFromPivot(y2s, pivot) : NaN;
  const years2e = Number.isFinite(y2e) ? yearsFromPivot(y2e, pivot) : NaN;

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
      diameterScaled: baselineDiameterMeters, // введений ДІАМЕТР О1-start (м)
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
