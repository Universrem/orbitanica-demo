// /js/data/geo_lib.js
'use strict';

/**
 * Лоадер «Географії» для конкретного підрежиму.
 * Віддає: OFFICIAL (/data/geography.json) + UGC (Supabase) ТІЛЬКИ для запитаного mode.
 * Кеш окремо на кожен mode.
 *
 * Публічне API:
 *   await loadGeoLibrary(mode)            // 'geo_objects' | 'geo_area' | 'geo_population'
 *   await readyGeo(mode)                  // детермінований бар'єр готовності кешу
 *   getGeoLibrary(mode)                   // отримати змерджений масив (може бути порожнім)
 *   await refreshGeoLibrary(mode)         // перезавантажити й надіслати подію
 *   addToGeoLibrary(mode, userRow)        // миттєво додати/замінити UGC у кеші (і кинути подію)
 *   removeFromGeoLibrary(mode, id)        // миттєво видалити UGC із кешу (і кинути подію)
 *   getById(mode, id)                     // знайти запис у кеші за id
 *   resolveObject(mode, hint)             // розв’язати об’єкт за {id, category_key, name, lang}
 */

import { listPublic, listMine } from '../../cabinet/js/cloud/userObjects.cloud.js';

const MODE_FIELD = {
  geo_objects:   'linear',      // нормалізуємо з length|height
  geo_area:      'area',
  geo_population:'population',
};

const __cache     = new Map();   // mode -> array (мердж OFFICIAL + UGC, вже нормалізовані)
const __promises  = new Map();   // mode -> Promise завантаження
const __readyOnce = new Map();   // mode -> Promise, що резолвиться при першому готовому кеші

/* ───────────────────────────── Мова та утиліти ───────────────────────────── */

const LANGS = ['en','es','ua'];
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

function toVU(rawV, rawU) {
  const v = Number(rawV);
  const u = norm(rawU);
  if (!Number.isFinite(v) || v <= 0 || !u) return null;
  return { value: v, unit: u };
}

function normalizeUserObject(row, mode) {
  if (!row || !mode || row?.mode !== mode) return null;

  const key = MODE_FIELD[mode];
  if (!key) return null;

  // Головні поля UGC: value / unit_key — однаково для всіх режимів
  const v = Number(row?.value);
  const u = row?.unit_key ?? row?.unit ?? null;

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

    // режимне поле
    [key]: (Number.isFinite(v) && v > 0 && u) ? { value: v, unit: String(u) } : null,

    // мета
    curated: !!row.curated,
    is_official: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  return rec;
}

/* ─────────────────────── Нормалізація OFFICIAL → формат бібліотеки ───────────────────────
   Гарантуємо {id, category_key, name_*, description_*, [key]:{value,unit}} для кожного підрежиму.
*/

function normalizeOfficial(rec, mode) {
  if (!rec || !mode) return null;
  const key = MODE_FIELD[mode];
  if (!key) return null;

  let vu = null;

  if (mode === 'geo_objects') {
    // пріоритет length → height
    const lv = rec?.length?.value, lu = rec?.length?.unit;
    const hv = rec?.height?.value, hu = rec?.height?.unit;
    vu = toVU(lv, lu) || toVU(hv, hu);
  } else if (mode === 'geo_area') {
    vu = toVU(rec?.area?.value, rec?.area?.unit);
  } else if (mode === 'geo_population') {
    vu = toVU(rec?.population?.value, rec?.population?.unit);
  }

  // Можливі записи без числового поля — допустимо (щоб показати категорію/назву),
  // але тоді [key] буде null, і UI просто не запропонує такий запис як вимірюваний.
  const category_key = ensureCategoryKey(rec);
  const id = norm(rec?.id) || makeStableIdForOfficial(mode, { ...rec, category_key });

  const out = {
    source: 'official',
    is_user_object: false,

    id,
    category_key,
    category_id: category_key, // зворотна сумісність

    // переносимо i18n як є
    name_ua: rec?.name_ua, name_en: rec?.name_en, name_es: rec?.name_es,
    category_ua: rec?.category_ua, category_en: rec?.category_en, category_es: rec?.category_es,
    description_ua: rec?.description_ua, description_en: rec?.description_en, description_es: rec?.description_es,

    [key]: vu,   // {value,unit} або null

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
  const byId = new Map();
  for (const r of officialNorm) {
    if (!r?.id) continue;
    byId.set(String(r.id), r);
  }
  for (const u of userNorm) {
    if (!u?.id) continue;
    byId.set(String(u.id), u); // UGC має пріоритет за тим самим id
  }
  return Array.from(byId.values());
}

async function buildForMode(mode) {
  const [officialRaw, userObjs] = await Promise.all([
    fetchOfficial(),
    fetchUserByMode(mode),
  ]);

  // 1) Нормалізація офіційних
  const officialNorm = officialRaw
    .map(r => normalizeOfficial(r, mode))
    .filter(Boolean);

  // 2) Юзерські вже нормалізовані
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
  if (!MODE_FIELD[mode]) throw new Error(`[geo_lib] unknown mode: ${mode}`);
  if (__promises.has(mode)) return __promises.get(mode);

  const p = (async () => {
    const merged = await buildForMode(mode);
    __cache.set(mode, merged);

    if (!__readyOnce.has(mode)) {
      let resolveReady;
      const pr = new Promise(res => { resolveReady = res; });
      __readyOnce.set(mode, pr);
      resolveReady();     // кеш уже є
      emitReady(mode, 'first-load');
    } else {
      emitReady(mode, 'reload');
    }
  })();

  __promises.set(mode, p);
  return p;
}

export async function readyGeo(mode) {
  if (!mode) throw new Error('[geo_lib] mode is required');
  if (!MODE_FIELD[mode]) throw new Error(`[geo_lib] unknown mode: ${mode}`);
  if (!__cache.has(mode) && !__promises.has(mode)) {
    await loadGeoLibrary(mode);
  }
  const r = __readyOnce.get(mode);
  if (r) return r;
  let resolveReady;
  const pr = new Promise(res => { resolveReady = res; });
  __readyOnce.set(mode, pr);
  resolveReady();
  return pr;
}

export async function refreshGeoLibrary(mode) {
  if (!mode) throw new Error('[geo_lib] mode is required');
  if (!MODE_FIELD[mode]) throw new Error(`[geo_lib] unknown mode: ${mode}`);
  __promises.delete(mode);
  __cache.delete(mode);
  await loadGeoLibrary(mode);
  emitReloaded(mode, 'refresh');
}

export function getGeoLibrary(mode) {
  return __cache.get(mode) || [];
}

export function addToGeoLibrary(mode, userRow) {
  if (!mode || !userRow) return null;
  if (!MODE_FIELD[mode]) return null;

  const normalized = normalizeUserObject(userRow, mode);
  if (!normalized) return null;

  const cur = Array.isArray(__cache.get(mode)) ? [...__cache.get(mode)] : [];

  // за id
  const next = cur.filter(item => String(item?.id) !== String(normalized.id));
  next.unshift(normalized);

  __cache.set(mode, next);
  emitReloaded(mode, 'user-add', { id: normalized.id });
  return normalized;
}

export function removeFromGeoLibrary(mode, id) {
  if (!mode || !id) return false;
  if (!MODE_FIELD[mode]) return false;
  const cur = Array.isArray(__cache.get(mode)) ? __cache.get(mode) : [];
  const next = cur.filter(it => String(it?.id) !== String(id));
  if (next.length === cur.length) return false;

  __cache.set(mode, next);
  emitReloaded(mode, 'user-remove', { id });
  return true;
}

export function getById(mode, id) {
  if (!mode || !id) return null;
  const list = __cache.get(mode);
  if (!Array.isArray(list)) return null;
  return list.find(it => String(it?.id) === String(id)) || null;
}

export function resolveObject(mode, hint = {}) {
  const list = __cache.get(mode);
  if (!Array.isArray(list) || !list.length) return null;

  const lang = normalizeLang(hint.lang) || currentLang();
  const pickName = (rec) => {
    const key = `name_${lang}`;   // конкретна мова без каскаду
    return norm(rec?.[key] || '');
  };

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
   Очікувані detail-поля:
     user-objects-updated: { mode, object }   // object — сирий рядок із Supabase
     user-objects-removed: { mode, id }       // id — UUID/PK
*/

function __onUserObjectUpdated(e) {
  try {
    const d = e?.detail || {};
    const m = d?.mode;
    if (!m || !MODE_FIELD[m] || !d.object) return;
    addToGeoLibrary(m, d.object);
  } catch(err) {
    console.warn('[geo_lib] user-objects-updated handler:', err);
  }
}

function __onUserObjectRemoved(e) {
  try {
    const d = e?.detail || {};
    const m = d?.mode;
    if (!m || !MODE_FIELD[m] || !d.id) return;
    removeFromGeoLibrary(m, d.id);
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
