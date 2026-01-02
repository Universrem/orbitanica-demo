// js/data/data_luminosity.js
'use strict';

/**
 * Адаптер даних для режиму «Світність».
 * SNAPSHOT-FIRST для О1 і О2:
 *  - шукаємо snapshot в dataset вибраного <option>;
 *  - якщо є — використовуємо його (без пошуків у бібліотеках);
 *  - якщо немає — фолбек у univers-бібліотеку/юзерський стор.
 *
 * Експорт:
 *  - getLuminosityData(scope?): StandardData
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

// ключ категорії (узгоджено з blocks)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

// конвертація світності → базова одиниця режиму (у нас це L☉) через централізований конвертер
function toBaseViaConverter(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;
  const u = (unit && String(unit)) || getBaseUnit('luminosity') || 'L☉';
  try {
    // convertToBase для 'luminosity' повертає значення в базовій одиниці (L☉)
    return convertToBase(v, u, 'luminosity');
  } catch {
    return NaN;
  }
}

// Прочитати "як є" (саме те, що записано в бібліотеці/UGC) — для показу в інфопанелі
function readLuminosityRaw(source) {
  const baseU = getBaseUnit('luminosity') || 'L☉';

  // 1) univers/нормалізована бібліотека: { luminosity: { value, unit } }
  if (source?.luminosity && typeof source.luminosity === 'object') {
    const v = Number(source.luminosity.value);
    const u = String(source.luminosity.unit || baseU).trim();
    return { valueRaw: v, unitRaw: u || baseU };
  }

  // 2) юзерський (старий формат модалки): attrs.luminosity { value, unit }
  if (source?.attrs?.luminosity && typeof source.attrs.luminosity === 'object') {
    const v = Number(source.attrs.luminosity.value);
    const u = String(source.attrs.luminosity.unit || source.unit || baseU).trim();
    return { valueRaw: v, unitRaw: u || baseU };
  }

  // 3) плоскі поля (сумісність)
  if (source && typeof source === 'object') {
    const v = Number(source.luminosityValue ?? source.value ?? source.luminosity);
    const u = String(
      (source.luminosityUnit ?? source.unit ?? (source.luminosity && source.luminosity.unit) ?? baseU)
    ).trim();
    return { valueRaw: v, unitRaw: u || baseU };
  }

  return { valueRaw: NaN, unitRaw: baseU };
}

// Прочитати і базове (для розрахунку), і "як є" (для показу)
function readLuminosityBaseAndRaw(source) {
  const baseU = getBaseUnit('luminosity') || 'L☉';
  const raw = readLuminosityRaw(source);

  const valueBase = toBaseViaConverter(raw.valueRaw, raw.unitRaw || baseU);
  return {
    valueBase,
    unitBase: baseU,
    valueRaw: raw.valueRaw,
    unitRaw: raw.unitRaw || baseU
  };
}


// Діаметр базового кола О1 (м)
function readBaselineDiameterMeters(scope) {
  const root = scope || document;
  const a = root?.querySelector('#lumiCircleObject1, [data-field="baseline-diameter"]');
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

  // пріоритетно — getByName('luminosity', ...)
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

// ─────────────────────────────────────────────────────────────
// NEW: Snapshot-first читання для О1 і О2 (з option.dataset.snapshot)

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

    // Мінімум валідації: значення > 0 і є unit
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
 * Для світності пишемо в поле `luminosity { value, unit }`.
 * category_id беремо з snapshot.category_key або із селектора категорії.
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

    // ОСНОВНЕ для режиму «Світність»
    luminosity: {
      value: Number(snapshot.value),
      unit:  String(snapshot.unit)
    },

    // описи — не обов'язкові
    description_ua: snapshot.description_ua ?? null,
    description_en: snapshot.description_en ?? null,
    description_es: snapshot.description_es ?? null
  };

  // валідація: значення має бути > 0
  if (!Number.isFinite(rec.luminosity.value) || rec.luminosity.value <= 0) return null;
  return rec;
}

/**
 * Прочитати О1 зі snapshot, прикріпленого до обраного option у #lumiObject1.
 */
function readO1FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'lumiObject1');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  const catKeySelect = getVal(scope, '#lumiCategoryObject1, .object1-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

/**
 * Прочитати О2 зі snapshot, прикріпленого до обраного option у #lumiObject2.
 */
function readO2FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'lumiObject2');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  const catKeySelect = getVal(scope, '#lumiCategoryObject2, .object2-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

// ─────────────────────────────────────────────────────────────
// Експорт

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Світність»).
 * @param {HTMLElement} [scope] - опційно: контейнер підсекції режиму (details#univers_luminosity)
 */
export function getLuminosityData(scope) {
  const lang  = getCurrentLang?.() || 'ua';
  const lib   = getUniversLibrary(); // загальна univers-бібліотека
  const store = getStore();

  // вибір користувача
  const catO1  = getVal(scope, '#lumiCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#lumiCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#lumiObject1,         .object1-group .object-select');
  const nameO2 = getVal(scope, '#lumiObject2,         .object2-group .object-select');

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // SNAPSHOT-FIRST
  let obj1 = readO1FromSnapshot(scope);
  let obj2 = readO2FromSnapshot(scope);

  // Якщо снапшота немає — фолбеки як раніше (бібліотека → стор)
  let off1 = null, off2 = null;

  if (!obj1) {
    off1 = findOfficial(lib, { category: catO1, name: nameO1 }) || (nameO1 && findOfficial(lib, { category: '', name: nameO1 }));
    obj1 = off1?.obj || findUser(store, { category: catO1, name: nameO1 }) || null;
  }
  if (!obj2) {
    off2 = findOfficial(lib, { category: catO2, name: nameO2 }) || (nameO2 && findOfficial(lib, { category: '', name: nameO2 }));
    obj2 = off2?.obj || findUser(store, { category: catO2, name: nameO2 }) || null;
  }

  // локалізація
  const name1 = obj1 ? pickLang(obj1, 'name', lang)        : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang)    : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang)        : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang)    : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';


    const r1 = readLuminosityBaseAndRaw(obj1);
  const r2 = readLuminosityBaseAndRaw(obj2);


  // стандартний пакет
  return {
    modeId: 'luminosity',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'value',
            // для розрахунку (в базовій одиниці, L☉)
      valueReal: Number.isFinite(r1.valueBase) ? r1.valueBase : NaN,
      unit: r1.unitBase || getBaseUnit('luminosity'),

      // для показу в інфопанелі (як записано в бібліотеці: W/kW/.../L☉)
      valueDisplay: Number.isFinite(r1.valueRaw) ? r1.valueRaw : NaN,
      unitDisplay: r1.unitRaw || r1.unitBase,

      diameterScaled: baselineDiameterMeters,      // базовий діаметр О1 (м)
      color: undefined,
      libIndex: off1?.libIndex ?? -1,
      userId: obj1?.id || obj1?._id || undefined
    },
    object2: {
      name: name2,
      category: cat2,
      description: desc2,
      kind: 'value',
            valueReal: Number.isFinite(r2.valueBase) ? r2.valueBase : NaN,
      unit: r2.unitBase || getBaseUnit('luminosity'),

      valueDisplay: Number.isFinite(r2.valueRaw) ? r2.valueRaw : NaN,
      unitDisplay: r2.unitRaw || r2.unitBase,

      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
