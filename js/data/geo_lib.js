// /js/data/geo_lib.js
'use strict';

/**
 * Лоадер «Географії» для підрежимів — СТРОГО за еталоном «Діаметри»,
 * з власними назвами та жорсткою вимогою: unit ОБОВ’ЯЗКОВО присутній (не null/порожній).
 *
 * Публічне API:
 *   await loadGeoLibrary(mode)            // 'geo_objects' | 'geo_area' | 'geo_population'
 *   await readyGeo(mode)                  // детермінований бар'єр готовності кешу
 *   getGeoLibrary(mode)                   // отримати змерджений масив (може бути порожнім)
 *   await refreshGeoLibrary(mode)         // перезавантажити й надіслати подію
 *   addToGeoLibrary(mode, userRow)        // миттєво додати/замінити UGC у кеші (і кинути подію)
 *   removeFromGeoLibrary(mode, id)        // миттєво видалити UGC із кешу (і кинути подію)
 *   getById(mode, id)                     // знайти запис у кеші за id (user/official)
 *   resolveObject(mode, hint)             // розв’язати об’єкт за {id, category_key, name, lang}
 */

import { listPublic, listMine } from '../../cabinet/js/cloud/userObjects.cloud.js';

const MODE_FIELD = {
  geo_objects:    'object',
  geo_area:       'area',
  geo_population: 'population',
};

const __cache     = new Map();   // mode -> array (мердж OFFICIAL + UGC, вже нормалізовані)
const __promises  = new Map();   // mode -> Promise завантаження
const __readyOnce = new Map();   // mode -> Promise, що резолвиться при першому готовому кеші

/* ───────────────────────────── Мова та утиліти ───────────────────────────── */

const LANGS = ['en','es','ua']; // алфавітно
const norm = (s) => String(s ?? '').trim();
const low  = (s) => norm(s).toLowerCase();

function normalizeLang(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s.startsWith('ua')) return 'ua';
  if (s.startsWith('en')) return 'en';
  if (s.startsWith('es')) return 'es';
  return '';
}

// Обережний детектор поточної мови інтерфейсу (без змін системного i18n)
function currentLang() {
  try {
    const cand =
      (typeof window !== 'undefined' && (window.__I18N_LANG || window.I18N_LANG || window.APP_LANG || window.LANG)) ||
      (document?.documentElement?.getAttribute('lang') || '') ||
      (typeof localStorage !== 'undefined' && (
        localStorage.getItem('i18nextLng') ||
        localStorage.getItem('lang') ||
        localStorage.getItem('ui.lang') ||
        localStorage.getItem('app.lang') ||
        localStorage.getItem('locale') || ''
      )) ||
      (typeof navigator !== 'undefined' && (navigator.language || (navigator.languages && navigator.languages[0]) || '')) ||
      '';
    return normalizeLang(cand) || 'ua';
  } catch { return 'ua'; }
}

// Порядок пошуку значень: поточна → інші (алфавітно)
function langsOrder(curr) {
  const c = (curr || 'ua').toLowerCase();
  return [c, ...LANGS.filter(x => x !== c)];
}

// Узагальнений пікер: *_ua/*_en/*_es → одне значення з фолбеком
function pickLocalized(src, base, lang) {
  const order = langsOrder(lang);
  for (const L of order) {
    const v = norm(src?.[`${base}_${L}`]);
    if (v) return v;
  }
  // крайній фолбек — нейтральне поле без суфікса
  return norm(src?.[base]);
}

/* ───────────────────────────── Ідентифікатори ───────────────────────────── */

// Детермінований простий хеш → стабільний псевдо-id для OFFICIAL, якщо немає id
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, '0');
}
function makeStableIdForOfficial(mode, rec) {
  const lang = currentLang();
  const name = pickLocalized(rec, 'name', lang) || pickLocalized(rec, 'name', 'en') || '';
  const cat  = pickLocalized(rec, 'category', lang) || pickLocalized(rec, 'category', 'en') || '';
  const key  = String(rec?.category_key || rec?.category_id || '').trim();
  const basis = `${mode}|${key}|${low(name)}|${low(cat)}`;
  return `off-${mode}-${djb2(basis)}`;
}

// Приведення категорії до стабільного ключа (якщо не вказаний)
function ensureCategoryKey(rec) {
  const existed = norm(rec?.category_key || rec?.category_id);
  if (existed) return existed;
  const lang = currentLang();
  const label = pickLocalized(rec, 'category', lang) ||
                pickLocalized(rec, 'category', 'en') ||
                pickLocalized(rec, 'name', 'en') || 'misc';
  return low(label).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'misc';
}

/* ───────────────────────── Нормалізація UGC → формат бібліотеки ───────────────────────── */

function normalizeUserObject(row, mode) {
  if (!row || !mode || row?.mode !== mode) return null;

  const key = MODE_FIELD[mode];
  if (!key) return null;

  // значення та одиниця з сирого запису (UGC) — unit ОБОВ’ЯЗКОВО
  const rawVal =
    row.value ?? row.value1 ??
    row.length ?? row.height ??  // можливі сумісні поля
    row.area ?? row.population;

  const rawUnit = row.unit_key ?? row.unit ?? row.unit1_key ?? row.unit1;

  const v = Number(rawVal);
  const u = norm(rawUnit);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (!u) return null; // unit обов'язковий

  const rec = {
    // джерело
    source: 'user',
    is_user_object: true,
    user_id: row.owner_id,

    // ідентифікація
    id: row.id,
    category_key: row.category_key,
    category_id:  row.category_key, // зворотна сумісність

    // i18n
    name_ua: row.name_ua, name_en: row.name_en, name_es: row.name_es,
    category_ua: row.category_ua, category_en: row.category_en, category_es: row.category_es,
    description_ua: row.description_ua, description_en: row.description_en, description_es: row.description_es,

    // режимне поле (unit вже перевірений)
    [key]: { value: v, unit: u },

    // мета
    curated: !!row.curated,
    is_official: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  return rec;
}

/* ─────────────────────── Нормалізація OFFICIAL → формат бібліотеки ───────────────────────
   Еталон: гарантуємо {id, category_key, name_*, description_*, [key]:{value,unit}},
   записи без валідного числа АБО без unit — відкидаємо (return null).
*/

function normalizeOfficial(rec, mode) {
  if (!rec || !mode) return null;
  const key = MODE_FIELD[mode];
  if (!key) return null;

  // 1) Значення + одиниці за підрежимом (unit ОБОВ’ЯЗКОВО)
  let rawV, rawU;

  if (mode === 'geo_objects') {
    // пріоритет length → height
    const lv = rec?.length?.value, lu = rec?.length?.unit;
    const hv = rec?.height?.value, hu = rec?.height?.unit;
    if (Number.isFinite(Number(lv)) && Number(lv) > 0 && norm(lu)) {
      rawV = lv; rawU = lu;
    } else if (Number.isFinite(Number(hv)) && Number(hv) > 0 && norm(hu)) {
      rawV = hv; rawU = hu;
    } else {
      return null;
    }
  } else if (mode === 'geo_area') {
    rawV = rec?.area?.value; rawU = rec?.area?.unit;
    if (!(Number.isFinite(Number(rawV)) && Number(rawV) > 0 && norm(rawU))) return null;
  } else if (mode === 'geo_population') {
    rawV = rec?.population?.value; rawU = rec?.population?.unit;
    if (!(Number.isFinite(Number(rawV)) && Number(rawV) > 0 && norm(rawU))) return null;
  }

  const v = Number(rawV);
  const u = norm(rawU);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (!u) return null;

  // 2) Категорія + id
  const category_key = ensureCategoryKey(rec);
  const id = norm(rec?.id) || makeStableIdForOfficial(mode, { ...rec, category_key });

  const out = {
    source: 'official',
    is_user_object: false,

    id,
    category_key,
    category_id: category_key, // зворотна сумісність

    // i18n як є
    name_ua: rec?.name_ua, name_en: rec?.name_en, name_es: rec?.name_es,
    category_ua: rec?.category_ua, category_en: rec?.category_en, category_es: rec?.category_es,
    description_ua: rec?.description_ua, description_en: rec?.description_en, description_es: rec?.description_es,

    [key]: { value: v, unit: u },

    is_official: true
  };

  return out;
}

/* ───────────────────────────── Завантаження ───────────────────────────── */

async function fetchOfficial() {
  const url = '/data/geography.json';
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    console.error('[geo_lib] network error', e);
    throw new Error('[geo_lib] failed to fetch geography.json');
  }
  if (!res.ok) throw new Error(`[geo_lib] HTTP ${res.status} for ${url}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('[geo_lib] geography.json must be an array of records');
  return data;
}

async function fetchUserByMode(mode) {
  const LIMIT = 500;
  const [mineRes, pubRes] = await Promise.all([
    listMine(mode, LIMIT, null),
    listPublic(mode, LIMIT, null),
  ]);

  const mine = Array.isArray(mineRes?.items) ? mineRes.items : [];
  const pub  = Array.isArray(pubRes?.items)  ? pubRes.items  : [];

  // уникаємо дублів за id
  const seenIds = new Set(mine.map(it => it?.id).filter(Boolean));
  const pubFiltered = pub.filter(it => it && !seenIds.has(it.id));

  // нормалізуємо
  const all = [...mine, ...pubFiltered]
    .map(row => normalizeUserObject(row, mode))
    .filter(Boolean);

  return all;
}

function dedupeMerge(officialNorm, userNorm) {
  // Еталон: індексуємо OFFICIAL за id, поверх кладемо UGC за тим самим id
  const byId = new Map();
  for (const r of officialNorm) {
    if (!r?.id) continue;
    byId.set(String(r.id), r);
  }
  for (const u of userNorm) {
    if (!u?.id) continue;
    byId.set(String(u.id), u); // UGC має пріоритет
  }
  return Array.from(byId.values());
}

async function buildForMode(mode) {
  const [officialRaw, userObjs] = await Promise.all([
    fetchOfficial(),
    fetchUserByMode(mode),
  ]);

  // 1) Нормалізація OFFICIAL
  const officialNorm = officialRaw
    .map(r => normalizeOfficial(r, mode))
    .filter(Boolean);

  // 2) UGC вже нормалізовані
  const userNorm = userObjs;

  // 3) Мердж
  return dedupeMerge(officialNorm, userNorm);
}

/* ───────────────────────────── Події ───────────────────────────── */

function emitReady(mode, reason = 'ready') {
  try {
    const evName = `geo-lib:ready:${mode}`;
    const detail = { mode, reason };
    window.dispatchEvent(new CustomEvent(evName, { detail }));
    document.dispatchEvent(new CustomEvent(evName, { detail }));
  } catch {}
}

function emitReloaded(mode, reason, extra = {}) {
  try {
    const detail = { mode, reason, ...extra };
    window.dispatchEvent(new CustomEvent('geo-lib-reloaded', { detail }));
    document.dispatchEvent(new CustomEvent('geo-lib-reloaded', { detail }));
  } catch {}
}

/* ───────────────────────────── Публічні API ───────────────────────────── */

export async function loadGeoLibrary(mode) {
  if (!mode) throw new Error('[geo_lib] mode is required');
  if (__promises.has(mode)) return __promises.get(mode);

  const p = (async () => {
    const merged = await buildForMode(mode);
    __cache.set(mode, merged);

    // перший раз — резолвимо readyOnce + кидаємо подію готовності
    if (!__readyOnce.has(mode)) {
      let resolveReady;
      const pr = new Promise(res => { resolveReady = res; });
      __readyOnce.set(mode, pr);
      resolveReady();     // кеш уже є
      emitReady(mode, 'first-load');
    } else {
      // якщо readyOnce уже створений — просто сигналізуємо, що кеш оновлено
      emitReady(mode, 'reload');
    }
  })();

  __promises.set(mode, p);
  return p;
}

/** Детермінований бар’єр готовності кешу для mode. */
export async function readyGeo(mode) {
  if (!mode) throw new Error('[geo_lib] mode is required');
  // якщо кешу ще нема — стартуємо завантаження
  if (!__cache.has(mode) && !__promises.has(mode)) {
    await loadGeoLibrary(mode);
  }
  const r = __readyOnce.get(mode);
  if (r) return r;
  // якщо readyOnce ще не було, але кеш уже є — створимо резолвнуте
  let resolveReady;
  const pr = new Promise(res => { resolveReady = res; });
  __readyOnce.set(mode, pr);
  resolveReady();
  return pr;
}

export async function refreshGeoLibrary(mode) {
  if (!mode) throw new Error('[geo_lib] mode is required');
  __promises.delete(mode);
  __cache.delete(mode);
  // readyOnce залишаємо — це бар’єр "один раз був готовий".
  await loadGeoLibrary(mode);
  emitReloaded(mode, 'refresh');
}

export function getGeoLibrary(mode) {
  return __cache.get(mode) || [];
}

/**
 * Миттєво додати/оновити UGC у кеші обраного режиму.
 * Викликати одразу після успішного створення/редагування в Supabase.
 * Повертає нормалізований запис або null.
 */
export function addToGeoLibrary(mode, userRow) {
  if (!mode || !userRow) return null;

  const normalized = normalizeUserObject(userRow, mode);
  if (!normalized) return null;

  const cur = Array.isArray(__cache.get(mode)) ? [...__cache.get(mode)] : [];

  // за id
  const next = cur.filter(item => String(item?.id) !== String(normalized.id));
  next.unshift(normalized); // свіжий нагору

  __cache.set(mode, next);
  emitReloaded(mode, 'user-add', { id: normalized.id });
  return normalized;
}

/**
 * Миттєво видалити UGC з кешу обраного режиму та кинути подію.
 */
export function removeFromGeoLibrary(mode, id) {
  if (!mode || !id) return false;
  const cur = Array.isArray(__cache.get(mode)) ? __cache.get(mode) : [];
  const next = cur.filter(it => String(it?.id) !== String(id));
  if (next.length === cur.length) return false;

  __cache.set(mode, next);
  emitReloaded(mode, 'user-remove', { id });
  return true;
}

/**
 * Пошук у кеші за стабільним id.
 */
export function getById(mode, id) {
  if (!mode || !id) return null;
  const list = __cache.get(mode);
  if (!Array.isArray(list)) return null;
  return list.find(it => String(it?.id) === String(id)) || null;
}

/**
 * Резолвер об’єкта за підказкою.
 * Підтримує: id, category_key/category_id, name (+lang).
 * Пріоритет: id → (category_key + name) → name.
 * Використовує каскад локалізації імен (як еталон).
 */
export function resolveObject(mode, hint = {}) {
  const list = __cache.get(mode);
  if (!Array.isArray(list) || !list.length) return null;

  const lang = normalizeLang(hint.lang) || currentLang();
  const pickName = (rec) => pickLocalized(rec, 'name', lang);

  // 1) по id
  if (hint.id) {
    const byId = getById(mode, hint.id);
    if (byId) return byId;
  }

  // 2) по (category_key + name)
  const catKey = hint.category_key ?? hint.category_id ?? null;
  const hintNameLow = low(hint.name);
  if (catKey && hintNameLow) {
    const found = list.find(rec =>
      (rec?.category_key === catKey || rec?.category_id === catKey) &&
      low(pickName(rec)) === hintNameLow
    );
    if (found) return found;
  }

  // 3) по name
  if (hintNameLow) {
    const found = list.find(rec => low(pickName(rec)) === hintNameLow);
    if (found) return found;
  }

  return null;
}

/* ───────────────────────────── Глобальні слухачі UGC ─────────────────────────────
   Модульно: реагуємо на події з будь-якого місця (кабінет, інші UIs).
   Очікувані detail-поля:
     user-objects-updated: { mode, object }   // object — сирий рядок із Supabase
     user-objects-removed: { mode, id }       // id — UUID/PK
*/

function __onUserObjectUpdated(e) {
  try {
    const d = e?.detail || {};
    if (!d.mode || !d.object) return;
    addToGeoLibrary(d.mode, d.object);
  } catch(err) {
    console.warn('[geo_lib] user-objects-updated handler:', err);
  }
}

function __onUserObjectRemoved(e) {
  try {
    const d = e?.detail || {};
    if (!d.mode || !d.id) return;
    removeFromGeoLibrary(d.mode, d.id);
  } catch(err) {
    console.warn('[geo_lib] user-objects-removed handler:', err);
  }
}

// реєстрація (один раз)
try {
  window.addEventListener('user-objects-updated', __onUserObjectUpdated);
  document.addEventListener('user-objects-updated', __onUserObjectUpdated);

  window.addEventListener('user-objects-removed', __onUserObjectRemoved);
  document.addEventListener('user-objects-removed', __onUserObjectRemoved);
} catch {}
/** ───────────────────────────── Категорії для селектора ─────────────────────────────
 * Повертає масив категорій у форматі:
 *   { key, name_i18n: { ua, en, es }, isUser }
 * - Працює для ТРЬОХ підрежимів: 'geo_objects' | 'geo_area' | 'geo_population'
 * - Читає лише з кешу (readyGeo(mode) → getGeoLibrary(mode)).
 * - Групування строго за category_key.
 * - isUser === true, якщо для key немає жодного запису з is_official===true.
 * - Порядок — за першою появою key у кеші (стабільний), тай-брейк — по key.
 */
export async function listCategories(mode) {
  if (!mode) throw new Error('[geo_lib] listCategories(mode): mode is required');
  if (!Object.prototype.hasOwnProperty.call(MODE_FIELD, mode)) {
  throw new Error(`[geo_lib] listCategories: unsupported mode "${mode}"`);
}


  // гарантуємо готовність кешу саме для цього підрежиму
  await readyGeo(mode);
  const list = Array.isArray(getGeoLibrary(mode)) ? getGeoLibrary(mode) : [];

  const S = (v) => (v == null ? '' : String(v).trim());
  const byKey = new Map();  // key -> { key, name_i18n, isUser }
  const order = [];         // стабільний порядок за першою появою

  for (const rec of list) {
    const key = S(rec?.category_key || rec?.category_id);
    if (!key) continue;

    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        key,
        name_i18n: {
          ua: S(rec?.category_ua),
          en: S(rec?.category_en),
          es: S(rec?.category_es),
        },
        // стартуємо з припущення "користувацька", скинемо до false якщо є офіційний
        isUser: rec?.is_official ? false : true,
      };
      byKey.set(key, entry);
      order.push(key);
    } else {
      // дозаповнюємо локалізовані назви, якщо якісь порожні
      if (!entry.name_i18n.ua && rec?.category_ua) entry.name_i18n.ua = S(rec.category_ua);
      if (!entry.name_i18n.en && rec?.category_en) entry.name_i18n.en = S(rec.category_en);
      if (!entry.name_i18n.es && rec?.category_es) entry.name_i18n.es = S(rec.category_es);
      // якщо зустріли офіційний запис — категорія офіційна
      if (rec?.is_official) entry.isUser = false;
    }
  }

  // стабілізуємо вихід: порядок першої появи, тай-брейк по ключу
  const out = order.map(k => byKey.get(k)).filter(Boolean);
  out.sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    if (ia !== ib) return ia - ib;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  return out;
}
