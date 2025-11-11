// js/data/data_math.js
'use strict';

/**
 * Адаптер даних для режиму «Математика».
 * SNAPSHOT-FIRST для О2 (і О1 теж, якщо є):
 *  - шукаємо snapshot у dataset вибраного <option>;
 *  - якщо є — використовуємо його (без пошуків у бібліотеках);
 *  - якщо немає — фолбек у math-бібліотеку / юзерський стор.
 *
 * Експорт:
 *  - getMathData(scope?): StandardData
 */

import { getCurrentLang } from '../i18n.js';
import { getMathLibrary } from './math_lib.js';
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

// ключ категорії (узгоджено з blocks)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

function getVal(scope, sel) {
  const el = (scope || document)?.querySelector(sel);
  return el ? norm(el.value) : '';
}

// Діаметр базового кола (м)
function readBaselineDiameterMeters(scope) {
  const a = (scope || document)?.querySelector('#mathBaselineDiameter, [data-field="baseline-diameter"]');
  if (a) {
    const v = Number(a.value);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return 0;
}

// Прочитати (value, unit) з офіційного чи юзерського запису — для математики
function readMathValueUnit(source) {
  // 1) канонічний формат: { quantity: { value, unit } }
  if (source?.quantity && typeof source.quantity === 'object') {
    const v = Number(source.quantity.value);
    const u = norm(source.quantity.unit || 'unit');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }

  // 2) можливі плоскі/сумісні поля
  if (source && typeof source === 'object') {
    const v = Number(source.value ?? source.amount ?? source.numberValue ?? source.math?.value);
    const u = norm(
      source.unit ??
      source.math?.unit ??
      (source.quantity && source.quantity.unit) ??
      'unit'
    );
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }

  return { valueReal: NaN, unit: 'unit' };
}

// офіційний запис у бібліотеці: спершу за ключем категорії, потім за назвою (будь-якою мовою)
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
    // фолбек: по всій бібліотеці лише за назвою
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

// юзерський об’єкт зі стора (точне співпадіння назви+категорії)
function findUser(store, { category, name }) {
  if (!store) return null;
  if (typeof store.getByName === 'function') {
    const hit = store.getByName('math', name, category);
    if (hit) return hit;
  }
  // фолбек через list('math')
  if (typeof store.list === 'function') {
    const all = store.list('math') || [];
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

function parseOptionSnapshot(opt) {
  try {
    const raw = opt?.dataset?.snapshot;
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;

    // мінімальна валідація
    const v = Number(s.value);
    if (!Number.isFinite(v) || v <= 0) return null;
    const u = s.unit ? String(s.unit) : null;
    if (!u) return null;

    return s;
  } catch {
    return null;
  }
}

/**
 * Нормалізувати snapshot у структуру «як у бібліотеці», щоб решта коду не відрізняла.
 * Для математики пишемо в поле `quantity { value, unit }`.
 * category_id беремо з snapshot.category_key або із селекта категорії.
 */
function normalizeSnapshotToLibRecord(snapshot, catKeyFromSelect) {
  if (!snapshot) return null;
  const rec = {
    id: snapshot.id || null,
    source: 'user',
    is_user_object: true,

    // імена/категорії для pickLang/getCatKey
    name_ua: snapshot.name_ua ?? null,
    name_en: snapshot.name_en ?? null,
    name_es: snapshot.name_es ?? null,
    name:    snapshot.name_en || snapshot.name_ua || snapshot.name_es || '',

    category_id: snapshot.category_key || catKeyFromSelect || null,
    category_en: snapshot.category_en ?? null,
    category_ua: snapshot.category_ua ?? null,
    category_es: snapshot.category_es ?? null,
    category:    snapshot.category_en || snapshot.category_ua || snapshot.category_es || null,

    // ОСНОВНЕ для режиму «Математика»
    quantity: {
      value: Number(snapshot.value),
      unit:  String(snapshot.unit)
    },

    // описи — не обов'язкові
    description_ua: snapshot.description_ua ?? null,
    description_en: snapshot.description_en ?? null,
    description_es: snapshot.description_es ?? null
  };

  if (!Number.isFinite(rec.quantity.value) || rec.quantity.value <= 0) return null;
  return rec;
}

function readO1FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'mathObject1');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;
  const catKeySelect = getVal(scope, '#mathCategoryObject1, .object1-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

function readO2FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'mathObject2');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;
  const catKeySelect = getVal(scope, '#mathCategoryObject2, .object2-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

// ─────────────────────────────────────────────────────────────
// Експорт

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Математика»).
 * @param {HTMLElement} [scope] - контейнер секції режиму (details#math)
 */
export function getMathData(scope) {
  const lang = getCurrentLang?.() || 'ua';
  const lib  = getMathLibrary();
  const store = getStore();

  // Вибір користувача
  const catO1  = getVal(scope, '#mathCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#mathCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#mathObject1,         .object1-group .object-select');
  const nameO2 = getVal(scope, '#mathObject2,         .object2-group .object-select');

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // SNAPSHOT-FIRST
  let obj1 = readO1FromSnapshot(scope);
  let obj2 = readO2FromSnapshot(scope);

  // Якщо снапшота немає — фолбеки як раніше (бібліотека → стор)
  let off1 = null, off2 = null;

  if (!obj1) {
    off1 = findOfficial(lib, { category: catO1, name: nameO1 }) ||
           (nameO1 && findOfficial(lib, { category: '', name: nameO1 }));
    obj1 = off1?.obj || findUser(store, { category: catO1, name: nameO1 }) || null;
  }
  if (!obj2) {
    off2 = findOfficial(lib, { category: catO2, name: nameO2 }) ||
           (nameO2 && findOfficial(lib, { category: '', name: nameO2 }));
    obj2 = off2?.obj || findUser(store, { category: catO2, name: nameO2 }) || null;
  }

  // локалізація
  const name1 = obj1 ? pickLang(obj1, 'name', lang)        : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang)    : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang)        : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang)    : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  // значення
  const { valueReal: v1, unit: u1 } = readMathValueUnit(obj1);
  const { valueReal: v2, unit: u2 } = readMathValueUnit(obj2);

  // стандартний пакет
  return {
    modeId: 'math',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'value',
      valueReal: Number.isFinite(v1) ? v1 : NaN,
      unit: u1 || 'unit',
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
      unit: u2 || 'unit',
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
