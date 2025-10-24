// /js/data/data_distance.js
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

// Юзерський об'єкт зі стора або з кешу univers_lib
function findUser(store, { type, category, name }) {
  if (!store) return null;
  
  // Спочатку шукаємо в актуальному кеші univers_lib
  try {
    const lib = getUniversLibrary('distance') || [];
    const nName = low(name);
    const nCat = low(category);
    const currentLang = getCurrentLang?.() || 'ua';
    
    const libHit = lib.find(item => {
      if (item.source !== 'user') return false;
      // звіряємо саме локалізовану назву з бібліотеки з вибором користувача
      const localizedName = pickLang(item, 'name', currentLang);
      return low(localizedName) === nName && getCatKey(item) === nCat;
    });

    if (libHit) return libHit;
  } catch (e) {
    console.warn('[data_distance] univers_lib search failed:', e);
  }
  
  // Фолбек на старий метод
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
      // підтримка unit_key з Supabase і звичайного unit
      source.distanceUnit ?? source.unit ?? source.unit_key ?? (source.distance_to_earth && source.distance_to_earth.unit) ?? DIST_BASE
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
// NEW: Snapshot-first зчитування О2 (з option.dataset.snapshot)

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
    // Перевірка мінімуму
    if (!s || typeof s !== 'object') return null;
    const v = Number(s.value);
    if (!Number.isFinite(v) || v <= 0) return null;
    // unit обов’язково має бути рядком
    const u = s.unit ? String(s.unit) : null;
    if (!u) return null;
    return s;
  } catch {
    return null;
  }
}

/**
 * Нормалізувати snapshot у структуру «як у бібліотеці», щоб решта коду не відрізняла.
 * ВАЖЛИВО: category_id заповнюємо з snapshot.category_key (або з селекта категорії).
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
    category_en: null,
    category_ua: null,
    category_es: null,
    category:    null,

    // основне режимне поле
    distance_to_earth: {
      value: Number(snapshot.value),
      unit:  String(snapshot.unit)
    },

    // описи — не обов'язкові
    description_ua: snapshot.description_ua ?? null,
    description_en: snapshot.description_en ?? null,
    description_es: snapshot.description_es ?? null,
  };

  // валідація: значення має бути > 0
  if (!Number.isFinite(rec.distance_to_earth.value) || rec.distance_to_earth.value <= 0) return null;
  return rec;
}

/**
 * Прочитати О2 зі snapshot, прикріпленого до обраного option у #distObject2.
 * Повертає нормалізований «lib‐record» або null.
 */
function readO2FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'distObject2');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;

  // categoryKey беремо з селекта категорій, якщо нема в snapshot
  const catKeySelect = getVal(scope, '#distCategoryObject2');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

// ─────────────────────────────────────────────────────────────
// Експорт

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Відстань»).
 * @param {HTMLElement} scope - контейнер підсекції режиму (details#univers_distance)
 */
export function getDistanceData(scope) {
  const lang  = getCurrentLang?.() || 'ua';
  const libO1 = getUniversLibrary('diameter') || [];
  const libO2 = getUniversLibrary('distance') || [];
  const store = getStore();

  // Вибір користувача:
  // О1 — лише назва (без категорії); О2 — категорія + назва
  const nameO1 = getVal(scope, '#distObject1');
  const catO2  = getVal(scope, '#distCategoryObject2');
  const nameO2 = getVal(scope, '#distObject2');

  // Офіційні/юзерські об’єкти
  // О1: шукаємо лише офіційний запис із валідним діаметром
  const srcO1 = Array.isArray(libO1) ? libO1.filter(hasDiameter) : [];
  let off1 = findOfficial(srcO1, { category: '', name: nameO1 });
  const obj1 = off1?.obj || null; // О1 тільки з бібліотеки (diameter)

  // О2: спроба №1 — SNAPSHOT-FIRST з option.dataset.snapshot
  let obj2 = readO2FromSnapshot(scope);

  // Якщо снапшота немає — працюємо як раніше: бібліотека/стор
  let off2 = null;
  if (!obj2) {
    // О2: тільки ті, де є distance_to_earth
    const src2 = (Array.isArray(libO2) ? libO2 : []).filter(hasDistanceToEarth);

    off2 = findOfficial(src2, { category: catO2, name: nameO2 });
    if (!off2 && nameO2) off2 = findOfficial(src2, { category: '', name: nameO2 });

    // Юзерський О2 допустимо, якщо має валідний distance_to_earth
    let user2 = findUser(store, { type: 'distance', category: catO2, name: nameO2 });
    if (user2) {
      const test = readDistanceToEarthBase(user2);
      if (!Number.isFinite(test.valueReal) || test.valueReal <= 0) user2 = null;
    }
    obj2 = off2?.obj || user2 || null;
  }

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
  const { valueReal: distBase, unit: u2 } = readDistanceToEarthBase(obj2);  // відстань О2 до Землі (у км)

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
      libIndex: (off2 && off2.libIndex != null) ? off2.libIndex : -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
