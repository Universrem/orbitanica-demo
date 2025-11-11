// js/data/data_mass.js
'use strict';

/**
 * Адаптер даних для режиму «Маса».
 * SNAPSHOT-FIRST для О1 і О2:
 *  - шукаємо snapshot у dataset вибраного <option>;
 *  - якщо є — використовуємо його (без пошуків у бібліотеках);
 *  - якщо немає — фолбек у univers-бібліотеку/юзерський стор.
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

// Офіційний запис у бібліотеці: спершу за категорією, далі за назвою (будь-якою мовою)
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
    // фолбек: по всій бібліотеці
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

// Юзерський об’єкт зі стора (точне співпадіння назви+категорії) з фолбеком
function findUser(store, { category, name }) {
  if (!store) return null;

  // пріоритетно — getByName('mass', ...)
  if (typeof store.getByName === 'function') {
    const hit = store.getByName('mass', name, category);
    if (hit) return hit;
  }
  // фолбек через list('mass')
  if (typeof store.list === 'function') {
    const all = store.list('mass') || [];
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

// Конвертація маси → базова одиниця через централізований конвертер
function toBaseMass(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;
  const baseU = getBaseUnit('mass');
  const u = (unit && String(unit)) || baseU;
  try {
    return convertToBase(v, u, 'mass'); // база для 'mass' визначається у unit_converter
  } catch {
    return NaN;
  }
}

// Прочитати масу (у базовій одиниці) із офіційного чи юзерського запису
function readMassBase(source) {
  const baseU = getBaseUnit('mass');

  // 1) офіційні: mass { value, unit }
  if (source?.mass && typeof source.mass === 'object') {
    const vb = toBaseMass(source.mass.value, source.mass.unit || baseU);
    if (Number.isFinite(vb)) return { valueReal: vb, unit: baseU };
  }

  // 2) юзерські через attrs
  if (source?.attrs?.mass && typeof source.attrs.mass === 'object') {
    const vb = toBaseMass(source.attrs.mass.value, source.attrs.mass.unit || baseU);
    if (Number.isFinite(vb)) return { valueReal: vb, unit: baseU };
  }

  // 3) можливі плоскі поля
  if (source && typeof source === 'object') {
    const vb = toBaseMass(
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
// SNAPSHOT-FIRST (читання з option.dataset.snapshot)

function getSelectedOption(scope, selectId) {
  const sel = scope?.querySelector(`#${selectId}`);
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

    // Мінімум валідації: value > 0, unit існує
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
 * Нормалізувати snapshot у «lib-подібний» запис, як у бібліотеці.
 * Для маси пишемо в поле `mass { value, unit }`.
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

    // ОСНОВНЕ для режиму «Маса»
    mass: {
      value: Number(snapshot.value),
      unit:  String(snapshot.unit)
    },

    // описи — не обов'язкові
    description_ua: snapshot.description_ua ?? null,
    description_en: snapshot.description_en ?? null,
    description_es: snapshot.description_es ?? null
  };

  // валідація: значення має бути > 0
  if (!Number.isFinite(rec.mass.value) || rec.mass.value <= 0) return null;
  return rec;
}

/** Прочитати О1 зі snapshot, прикріпленого до обраного option у #massObject1. */
function readO1FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'massObject1');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  const catKeySelect = getVal(scope, '#massCategoryObject1');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

/** Прочитати О2 зі snapshot, прикріпленого до обраного option у #massObject2. */
function readO2FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'massObject2');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  const catKeySelect = getVal(scope, '#massCategoryObject2');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

// ─────────────────────────────────────────────────────────────
// Експорт

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Маса»).
 * @param {HTMLElement} scope - контейнер підсекції режиму (details#univers_mass)
 */
export function getMassData(scope) {
  const lang  = getCurrentLang?.() || 'ua';
  const lib   = getUniversLibrary('mass') || []; // univers-бібліотека для маси
  const store = getStore();

  // Вибір користувача (строго під панель з префіксом mass*)
  const catO1  = getVal(scope, '#massCategoryObject1');
  const catO2  = getVal(scope, '#massCategoryObject2');
  const nameO1 = getVal(scope, '#massObject1');
  const nameO2 = getVal(scope, '#massObject2');

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // SNAPSHOT-FIRST
  let obj1 = readO1FromSnapshot(scope);
  let obj2 = readO2FromSnapshot(scope);

  // Якщо снапшота немає — фолбеки як раніше (бібліотека → стор), але лише серед тих, що мають масу
  let off1 = null, off2 = null;
  if (!obj1) {
    const src = lib.filter(hasMass);
    off1 = findOfficial(src, { category: catO1, name: nameO1 }) || (nameO1 && findOfficial(src, { category: '', name: nameO1 }));
    let user1 = findUser(store, { category: catO1, name: nameO1 });
    if (user1) {
      const test = readMassBase(user1);
      if (!Number.isFinite(test.valueReal) || test.valueReal <= 0) user1 = null;
    }
    obj1 = off1?.obj || user1 || null;
  }
  if (!obj2) {
    const src = lib.filter(hasMass);
    off2 = findOfficial(src, { category: catO2, name: nameO2 }) || (nameO2 && findOfficial(src, { category: '', name: nameO2 }));
    let user2 = findUser(store, { category: catO2, name: nameO2 });
    if (user2) {
      const test = readMassBase(user2);
      if (!Number.isFinite(test.valueReal) || test.valueReal <= 0) user2 = null;
    }
    obj2 = off2?.obj || user2 || null;
  }

  // Локалізація
  const name1 = obj1 ? pickLang(obj1, 'name', lang)        : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang)    : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang)        : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang)    : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  // Значення у базових одиницях маси
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
      diameterScaled: baselineDiameterMeters,       // базовий діаметр О1 (м) — масштабне коло
      color: undefined,
      libIndex: off1?.libIndex ?? -1,
      userId: obj1?.id || obj1?._id || undefined
    },
    object2: {
      name: name2,
      category: cat2,
      description: desc2,
      kind: 'value',
      valueReal: Number.isFinite(m2b) ? m2b : NaN,  // у базовій одиниці 'mass'
      unit: u2 || getBaseUnit('mass'),
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
