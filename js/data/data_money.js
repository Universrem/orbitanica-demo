// /js/data/data_money.js
'use strict';

/**
 * Адаптер даних для режиму «Гроші».
 * SNAPSHOT-FIRST для О1 і О2:
 *  - шукаємо snapshot у dataset вибраного <option>;
 *  - якщо є — використовуємо його (без пошуків у бібліотеках);
 *  - якщо немає — фолбек у money-бібліотеку / юзерський стор.
 *
 * Експорт:
 *  - getMoneyData(scope?): StandardData
 */

import { getCurrentLang } from '../i18n.js';
import { getMoneyLibrary } from './money_lib.js';
import { getStore } from '../userObjects/api.js';

/* ─────────────────────────────────────────────────────────────
   Утіліти
───────────────────────────────────────────────────────────── */

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
  return low(rec?.category_id ?? rec?.category_key ?? rec?.category_en ?? rec?.category ?? '');
}

// baseline діаметр О1 (м)
function readBaselineDiameterMeters(scope) {
  const root = scope || document;
  const a = root?.querySelector('#moneyBaselineDiameter, [data-field="baseline-diameter"]');
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

/* ─────────────────────────────────────────────────────────────
   Пошук у бібліотеці/сторі (фолбеки)
───────────────────────────────────────────────────────────── */

// офіційний запис: спершу звузити по категорії, потім шукати за назвою (будь-якою мовою)
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
    const hit = store.getByName('money', name, category);
    if (hit) return hit;
  }
  // фолбек через list('money')
  if (typeof store.list === 'function') {
    const all = store.list('money') || [];
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

/* ─────────────────────────────────────────────────────────────
   Читання значення грошей
───────────────────────────────────────────────────────────── */

function readMoneyValueUnit(source) {
  // 1) офіційний формат: { money: { value, unit } }
  if (source?.money && typeof source.money === 'object') {
    const v = Number(source.money.value);
    const u = norm(source.money.unit || 'USD');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }

  // 2) юзерський через модалку: attrs.money { value, unit } (узгоджено з UGC)
  if (source?.attrs?.money && typeof source.attrs.money === 'object') {
    const v = Number(source.attrs.money.value);
    const u = norm(source.attrs.money.unit || source.unit || source.currency || 'USD');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }

  // 3) можливі плоскі поля
  if (source && typeof source === 'object') {
    const v = Number(source.value ?? source.amount ?? source.moneyValue);
    const u = norm(source.unit ?? source.currency ?? (source.money && source.money.unit) ?? 'USD');
    if (Number.isFinite(v)) return { valueReal: v, unit: u };
  }

  return { valueReal: NaN, unit: 'USD' };
}

/* ─────────────────────────────────────────────────────────────
   NEW: Snapshot-first (з option.dataset.snapshot)
───────────────────────────────────────────────────────────── */

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
 * Нормалізувати snapshot у формат «як у бібліотеці», щоби решта коду була однакова.
 * Для «Грошей» пишемо в поле `money { value, unit }`.
 */
function normalizeSnapshotToLibRecord(snapshot, catKeyFromSelect) {
  if (!snapshot) return null;
  const rec = {
    id: snapshot.id || null,
    source: 'user',
    is_user_object: true,

    // для pickLang/getCatKey
    name_ua: snapshot.name_ua ?? null,
    name_en: snapshot.name_en ?? null,
    name_es: snapshot.name_es ?? null,
    name:    snapshot.name_en || snapshot.name_ua || snapshot.name_es || '',

    category_id: snapshot.category_key || catKeyFromSelect || null,
    category_key: snapshot.category_key || catKeyFromSelect || null,
    category_en: snapshot.category_en ?? null,
    category_ua: snapshot.category_ua ?? null,
    category_es: snapshot.category_es ?? null,
    category:    snapshot.category_en || snapshot.category_ua || snapshot.category_es || null,

    money: {
      value: Number(snapshot.value),
      unit:  String(snapshot.unit)
    },

    description_ua: snapshot.description_ua ?? null,
    description_en: snapshot.description_en ?? null,
    description_es: snapshot.description_es ?? null
  };

  if (!Number.isFinite(rec.money.value) || rec.money.value <= 0) return null;
  return rec;
}

/** Прочитати О1 із snapshot, прикріпленого до обраного option у #moneyObject1. */
function readO1FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'moneyObject1');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  const catKeySelect = getVal(scope, '#moneyCategoryObject1, .object1-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

/** Прочитати О2 із snapshot, прикріпленого до обраного option у #moneyObject2. */
function readO2FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'moneyObject2');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  const catKeySelect = getVal(scope, '#moneyCategoryObject2, .object2-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

/* ─────────────────────────────────────────────────────────────
   Експорт
───────────────────────────────────────────────────────────── */

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Гроші»).
 * @param {HTMLElement} [scope] - контейнер підсекції режиму (details#money)
 */
export function getMoneyData(scope) {
  const lang = getCurrentLang?.() || 'ua';
  const lib  = getMoneyLibrary();
  const store = getStore();

  // вибір користувача
  const catO1  = getVal(scope, '#moneyCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#moneyCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#moneyObject1,         .object1-group .object-select');
  const nameO2 = getVal(scope, '#moneyObject2,         .object2-group .object-select');

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

  const { valueReal: v1, unit: u1 } = readMoneyValueUnit(obj1);
  const { valueReal: v2, unit: u2 } = readMoneyValueUnit(obj2);

  // стандартний пакет
  return {
    modeId: 'money',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'value',
      valueReal: Number.isFinite(v1) ? v1 : NaN,
      unit: u1 || 'USD',
      diameterScaled: baselineDiameterMeters, // базовий діаметр О1 (м)
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
