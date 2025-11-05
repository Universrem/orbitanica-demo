// /js/data/data_geo_objects.js
'use strict';

/**
 * Адаптер даних для «Географія → Об’єкти» (SNAPSHOT-FIRST для О1 і О2).
 * Логіка як у «Діаметри», але для лінійних величин:
 *  - спершу читаємо snapshot з <option data-snapshot>;
 *  - якщо нема — фолбек у geo-бібліотеку / юзерський стор;
 *  - значення в метрах (valueReal), unit ОБОВ’ЯЗКОВО (дефолт 'm');
 *  - scaledMeters у панелі показує РАДІУС (налаштовано в подіях).
 *
 * Експорт:
 *  - getGeoObjectsData(scope?): StandardData
 */

import { getCurrentLang } from '../i18n.js';
import { getGeoLibrary } from './geo_lib.js';
import { getStore } from '../userObjects/api.js';
import { convertToBase, getBaseUnit } from '../utils/unit_converter.js';

/* ─────────────────────────────────────────────────────────────
 * Утіліти
 * ────────────────────────────────────────────────────────────*/

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
  const a = (scope || document)?.querySelector('#geoObjBaselineDiameter, [data-field="baseline-diameter"]');
  if (a) {
    const v = Number(a.value);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return 0;
}

/* ─────────────────────────────────────────────────────────────
 * Конвертори/читачі значень (лінійна величина → метри)
 * ────────────────────────────────────────────────────────────*/

function toMetersViaConverter(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;
  const u = norm(unit) || getBaseUnit('geo_objects') || 'm';
  try { return convertToBase(v, u, 'geo_objects'); }
  catch { return NaN; }
}

// Прочитати довжину/висоту (в метрах) із запису (OFFICIAL/UGC)
// ПРИМІТКА: geo_lib нормалізує в поле `object { value, unit }`.
function readGeoLinearMeters(source) {
  // 1) новий нормалізований формат: object { value, unit }
  if (source?.object && typeof source.object === 'object') {
    const vm = toMetersViaConverter(source.object.value, source.object.unit || 'm');
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }

  // 2) сумісність: length/height (можуть бути в OFFICIAL до нормалізації)
  if (source?.length && typeof source.length === 'object') {
    const vm = toMetersViaConverter(source.length.value, source.length.unit || 'm');
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }
  if (source?.height && typeof source.height === 'object') {
    const vm = toMetersViaConverter(source.height.value, source.height.unit || 'm');
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }

  // 3) юзерські attrs (сумісність)
  if (source?.attrs?.object && typeof source.attrs.object === 'object') {
    const vm = toMetersViaConverter(source.attrs.object.value, source.attrs.object.unit || 'm');
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }
  if (source?.attrs?.length && typeof source.attrs.length === 'object') {
    const vm = toMetersViaConverter(source.attrs.length.value, source.attrs.length.unit || 'm');
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }
  if (source?.attrs?.height && typeof source.attrs.height === 'object') {
    const vm = toMetersViaConverter(source.attrs.height.value, source.attrs.height.unit || 'm');
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }

  // 4) плоскі поля (сумісність)
  if (source && typeof source === 'object') {
    const vm = toMetersViaConverter(
      source.objectValue ?? source.lengthValue ?? source.heightValue ?? source.value,
      source.objectUnit  ?? source.lengthUnit  ?? source.heightUnit  ?? source.unit ?? 'm'
    );
    if (Number.isFinite(vm)) return { valueReal: vm, unit: 'm' };
  }

  return { valueReal: NaN, unit: 'm' };
}

/* ─────────────────────────────────────────────────────────────
 * SNAPSHOT-FIRST (dataset.snapshot на вибраному <option>)
 * ────────────────────────────────────────────────────────────*/

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
    if (!u) return null;            // unit ОБОВ’ЯЗКОВО
    return s;
  } catch { return null; }
}

/**
 * Нормалізувати snapshot у «бібліотечний» запис для гео-об’єктів.
 * Основне поле — `object { value, unit }`.
 * category_id беремо з snapshot.category_key або з селекта категорії.
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

    // ОСНОВНЕ для «Об’єкти»: лінійна величина
    object: {
      value: Number(snapshot.value),
      unit:  String(snapshot.unit || 'm') // unit не може бути порожнім
    },

    // описи — не обов'язкові
    description_ua: snapshot.description_ua ?? null,
    description_en: snapshot.description_en ?? null,
    description_es: snapshot.description_es ?? null
  };

  if (!Number.isFinite(rec.object.value) || rec.object.value <= 0) return null;
  return rec;
}

function readO1FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'geoObjObject1');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;
  const catKeySelect = getVal(scope, '#geoObjCategoryObject1, .object1-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

function readO2FromSnapshot(scope) {
  const opt = getSelectedOption(scope, 'geoObjObject2');
  if (!opt) return null;
  const s = parseOptionSnapshot(opt);
  if (!s) return null;
  const catKeySelect = getVal(scope, '#geoObjCategoryObject2, .object2-group .category-select');
  return normalizeSnapshotToLibRecord(s, catKeySelect || null);
}

/* ─────────────────────────────────────────────────────────────
 * Пошук у бібліотеці / сторі (фолбек, якщо snapshot відсутній)
 * ────────────────────────────────────────────────────────────*/

function findOfficialLinear(lib, { category, name }) {
  if (!Array.isArray(lib)) return null;

  // валідні лінійні записи: мають object.value>0 (або старі length/height)
  const src = lib.filter(o => {
    const ov = Number(o?.object?.value);
    const lv = Number(o?.length?.value);
    const hv = Number(o?.height?.value);
    return (Number.isFinite(ov) && ov > 0) ||
           (Number.isFinite(lv) && lv > 0) ||
           (Number.isFinite(hv) && hv > 0);
  });

  const catKey = low(category);
  let rows = src;
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
    for (let i = 0; i < src.length; i++) {
      const o = src[i];
      const n_en = low(o?.name_en);
      const n_ua = low(o?.name_ua);
      const n_es = low(o?.name_es);
      const n    = low(o?.name);
      if ([n_en, n_ua, n_es, n].some(v => v && v === needle)) {
        return { obj: o, libIndex: lib.indexOf(o) };
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

function findUserLinear(store, { category, name }) {
  if (!store) return null;

  // пріоритетно — getByName('geo_objects', ...)
  if (typeof store.getByName === 'function') {
    const hit = store.getByName('geo_objects', name, category);
    if (hit) return hit;
  }
  // фолбек — list('geo_objects')
  if (typeof store.list === 'function') {
    const all = store.list('geo_objects') || [];
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
 * Експорт
 * ────────────────────────────────────────────────────────────*/

/**
 * Зібрати StandardData для calc та інфопанелі (режим «Географія → Об’єкти»).
 * @param {HTMLElement} [scope] - контейнер секції режиму
 */
export function getGeoObjectsData(scope) {
  const lang  = getCurrentLang?.() || 'ua';
  const lib   = getGeoLibrary('geo_objects'); // ВАЖЛИВО: режим
  const store = getStore();

  // Вибір користувача
  const catO1  = getVal(scope, '#geoObjCategoryObject1, .object1-group .category-select');
  const catO2  = getVal(scope, '#geoObjCategoryObject2, .object2-group .category-select');
  const nameO1 = getVal(scope, '#geoObjObject1,         .object1-group .object-select');
  const nameO2 = getVal(scope, '#geoObjObject2,         .object2-group .object-select');

  const baselineDiameterMeters = readBaselineDiameterMeters(scope);

  // SNAPSHOT-FIRST
  let obj1 = readO1FromSnapshot(scope);
  let obj2 = readO2FromSnapshot(scope);

  // Якщо снапшота немає — фолбеки (бібліотека → стор)
  let off1 = null, off2 = null;

  if (!obj1) {
    off1 = findOfficialLinear(lib, { category: catO1, name: nameO1 }) ||
           (nameO1 && findOfficialLinear(lib, { category: '', name: nameO1 }));
    obj1 = off1?.obj || findUserLinear(store, { category: catO1, name: nameO1 }) || null;
  }
  if (!obj2) {
    off2 = findOfficialLinear(lib, { category: catO2, name: nameO2 }) ||
           (nameO2 && findOfficialLinear(lib, { category: '', name: nameO2 }));
    obj2 = off2?.obj || findUserLinear(store, { category: catO2, name: nameO2 }) || null;
  }

  // локалізація
  const name1 = obj1 ? pickLang(obj1, 'name', lang)        : nameO1;
  const cat1  = obj1 ? pickLang(obj1, 'category', lang)    : catO1;
  const desc1 = obj1 ? pickLang(obj1, 'description', lang) : '';

  const name2 = obj2 ? pickLang(obj2, 'name', lang)        : nameO2;
  const cat2  = obj2 ? pickLang(obj2, 'category', lang)    : catO2;
  const desc2 = obj2 ? pickLang(obj2, 'description', lang) : '';

  // значення (в метрах)
  const { valueReal: l1m, unit: u1 } = readGeoLinearMeters(obj1);
  const { valueReal: l2m, unit: u2 } = readGeoLinearMeters(obj2);

  // стандартний пакет
  return {
    modeId: 'geo_objects',
    object1: {
      name: name1,
      category: cat1,
      description: desc1,
      kind: 'length',
      valueReal: Number.isFinite(l1m) ? l1m : NaN, // у метрах
      unit: u1 || 'm',                              // unit обов’язковий
      diameterScaled: baselineDiameterMeters,       // діаметр базового кола О1 (м)
      color: undefined,
      libIndex: off1?.libIndex ?? -1,
      userId: obj1?.id || obj1?._id || undefined
    },
    object2: {
      name: name2,
      category: cat2,
      description: desc2,
      kind: 'length',
      valueReal: Number.isFinite(l2m) ? l2m : NaN, // у метрах
      unit: u2 || 'm',
      color: undefined,
      libIndex: off2?.libIndex ?? -1,
      userId: obj2?.id || obj2?._id || undefined
    }
  };
}
