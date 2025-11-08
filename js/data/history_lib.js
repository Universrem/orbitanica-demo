// /js/data/history_lib.js
'use strict';

/**
 * Еталонний лоадер бібліотеки для режиму «Історія» — за аналогією з geo_lib.
 * - Один мережевий запит на /data/history.json (OFFICIAL).
 * - Мердж із UGC (кабінет/хмара) з нормалізацією під спільний формат.
 * - Кешуємо і Promise, і готовий масив. Підтримуємо події ready/reloaded.
 *
 * Публічне API:
 *   await loadHistoryLibrary()
 *   getHistoryLibrary()
 *   await refreshHistoryLibrary()
 *   addToHistoryLibrary(userRow)
 *   removeFromHistoryLibrary(id)
 *   getById(id)
 *   resolveObject({ id, category_key, name, lang })
 *   listCategories(mode?)  // повертає [{ key, name_i18n:{ua,en,es}, isUser }, ...]
 */

import { listPublic, listMine } from '/cabinet/js/cloud/userObjects.cloud.js';

/* ───────────────────────────── Кеш/стан ───────────────────────────── */

let __histCache = [];
let __loadPromise = null;

/* ───────────────────────────── Утіліти ───────────────────────────── */

const S = v => (v == null ? '' : String(v).trim());
const low = v => S(v).toLowerCase();

const LANGS = ['en','es','ua'];
function normalizeLang(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s.startsWith('ua')) return 'ua';
  if (s.startsWith('en')) return 'en';
  if (s.startsWith('es')) return 'es';
  return 'ua';
}
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
    return normalizeLang(cand);
  } catch { return 'ua'; }
}
function pickLocalized(src, base, lang) {
  const order = [lang, ...LANGS.filter(x => x !== lang)];
  for (const L of order) {
    const v = S(src?.[`${base}_${L}`]);
    if (v) return v;
  }
  return S(src?.[base]);
}

// простий ASCII-слаг (як у geo_lib), але ми тепер беремо мову EN першою
function asciiSlug(input) {
  return low(input).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'misc';
}

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, '0');
}
function makeStableIdOfficial(rec) {
  const lang = currentLang();
  const name = pickLocalized(rec, 'name', lang) || pickLocalized(rec, 'name', 'en') || '';
  const cat  = pickLocalized(rec, 'category', lang) || pickLocalized(rec, 'category', 'en') || '';
  const key  = S(rec?.category_key || rec?.category_id);
  return `off-history-${djb2(`${key}|${low(name)}|${low(cat)}`)}`;
}

/**
 * СТАБІЛЬНИЙ, мовонезалежний ключ категорії.
 * Пріоритет EN → UA → ES → нейтральне поле → 'misc'.
 * ВАЖЛИВО: згенерований ключ однаковий незалежно від системної мови.
 */
function ensureCategoryKey(rec) {
  const existed = S(rec?.category_key || rec?.category_id);
  if (existed) return existed;

  const labelEn = S(rec?.category_en);
  const labelUa = S(rec?.category_ua);
  const labelEs = S(rec?.category_es);
  const neutral = S(rec?.category);

  const base =
    labelEn ||
    labelUa ||
    labelEs ||
    neutral ||
    pickLocalized(rec, 'category', 'en') ||
    'misc';

  return asciiSlug(base);
}

/* ───────────────────────────── Валідація/нормалізація ─────────────────────────────
   ІСТОРІЯ: усі дати — роки (цілі в UI, але тут тримаємо як Number).
   Дозволяємо від’ємні (BCE), нуль і додатні. unit — ОБОВ’ЯЗКОВО 'year' (нерегістрочутливо).
*/

function isYearUnit(u) {
  return low(u) === 'year' || low(u) === 'years';
}

function normOfficialHistory(rec) {
  if (!rec) return null;

  // time_start { value, unit }, time_end { value, unit }? — unit обов’язково
  const ts = rec?.time_start;
  const te = rec?.time_end;

  const v1 = Number(ts?.value);
  const u1 = S(ts?.unit);
  if (!Number.isFinite(v1) || !isYearUnit(u1)) return null;

  const catKey = ensureCategoryKey(rec);

  let out = {
    source: 'official',
    is_user_object: false,
    is_official: true,

    id: S(rec?.id) || makeStableIdOfficial({ ...rec, category_key: catKey }),
    category_key: catKey,
    category_id:  catKey,

    name_ua: rec?.name_ua, name_en: rec?.name_en, name_es: rec?.name_es,
    category_ua: rec?.category_ua, category_en: rec?.category_en, category_es: rec?.category_es,
    description_ua: rec?.description_ua, description_en: rec?.description_en, description_es: rec?.description_es,

    time_start: { value: v1, unit: 'year' }
  };

  if (te && isYearUnit(te.unit) && Number.isFinite(Number(te.value))) {
    out.time_end = { value: Number(te.value), unit: 'year' };
  }

  return out;
}

function normUserHistory(row) {
  if (!row || row.mode !== 'history') return null;

  // value/unit_key + optional value2/unit2_key — обидва у 'year'
  const v1 = Number(row?.value);
  const u1 = S(row?.unit_key);
  if (!Number.isFinite(v1) || !isYearUnit(u1)) return null;

  // стабілізуємо key: якщо не заданий — генеруємо EN→UA→ES→нейтральне
  let catKey = S(row.category_key || row.category_id);
  if (!catKey) {
    const base =
      S(row.category_en) ||
      S(row.category_ua) ||
      S(row.category_es) ||
      S(row.category) ||
      'misc';
    catKey = asciiSlug(base);
  }

  const out = {
    source: 'user',
    is_user_object: true,
    is_official: false,

    id: row.id,
    user_id: row.owner_id,

    category_key: catKey,
    category_id:  catKey,

    name_ua: row.name_ua, name_en: row.name_en, name_es: row.name_es,
    category_ua: row.category_ua, category_en: row.category_en, category_es: row.category_es,
    description_ua: row.description_ua, description_en: row.description_en, description_es: row.description_es,

    time_start: { value: v1, unit: 'year' },

    curated: !!row.curated,
    created_at: row.created_at,
    updated_at: row.updated_at
  };

  if (row.value2 != null && isYearUnit(row.unit2_key) && Number.isFinite(Number(row.value2))) {
    out.time_end = { value: Number(row.value2), unit: 'year' };
  }

  return out;
}

function mergeOfficialAndUser(officialArr, userArr) {
  const byId = new Map();
  for (const r of officialArr) if (r?.id) byId.set(String(r.id), r);
  for (const u of userArr) if (u?.id) byId.set(String(u.id), u); // UGC має пріоритет
  return Array.from(byId.values());
}

/* ───────────────────────────── Завантаження ───────────────────────────── */

async function fetchOfficial() {
  const url = '/data/history.json';
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    console.error('[history_lib] network error', e);
    throw new Error('[history_lib] failed to fetch history.json');
  }
  if (!res.ok) throw new Error(`[history_lib] HTTP ${res.status} for ${url}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('[history_lib] history.json must be an array of records');
  return data;
}

async function fetchUser() {
  const LIMIT = 500;
  const [mineRes, pubRes] = await Promise.all([
    listMine('history', LIMIT, null),
    listPublic('history', LIMIT, null),
  ]);
  const mine = Array.isArray(mineRes?.items) ? mineRes.items : [];
  const pub  = Array.isArray(pubRes?.items)  ? pubRes.items  : [];

  const seen = new Set(mine.map(x => x?.id).filter(Boolean));
  const pubFiltered = pub.filter(x => x && !seen.has(x.id));

  return [...mine, ...pubFiltered].map(normUserHistory).filter(Boolean);
}

function emitReady(reason = 'ready') {
  try {
    const detail = { mode: 'history', reason };
    window.dispatchEvent(new CustomEvent('history-lib:ready', { detail }));
    document.dispatchEvent(new CustomEvent('history-lib:ready', { detail }));
  } catch {}
}
function emitReloaded(reason, extra = {}) {
  try {
    const detail = { mode: 'history', reason, ...extra };
    window.dispatchEvent(new CustomEvent('history-lib-reloaded', { detail }));
    document.dispatchEvent(new CustomEvent('history-lib-reloaded', { detail }));
  } catch {}
}

/* ───────────────────────────── Публічні API ───────────────────────────── */

export async function loadHistoryLibrary() {
  if (__loadPromise) return __loadPromise;

  __loadPromise = (async () => {
    const [offRaw, userNorm] = await Promise.all([fetchOfficial(), fetchUser()]);
    const offNorm = offRaw.map(normOfficialHistory).filter(Boolean);
    __histCache = mergeOfficialAndUser(offNorm, userNorm);
    emitReady('first-load');
  })();

  return __loadPromise;
}

export function getHistoryLibrary() {
  return Array.isArray(__histCache) ? __histCache : [];
}

export async function refreshHistoryLibrary() {
  __loadPromise = null;
  __histCache = [];
  await loadHistoryLibrary();
  emitReloaded('refresh');
}

export function addToHistoryLibrary(userRow) {
  const norm = normUserHistory(userRow);
  if (!norm) return null;
  const cur = getHistoryLibrary();
  const next = [norm, ...cur.filter(r => String(r?.id) !== String(norm.id))];
  __histCache = next;
  emitReloaded('user-add', { id: norm.id });
  return norm;
}

export function removeFromHistoryLibrary(id) {
  const cur = getHistoryLibrary();
  const next = cur.filter(r => String(r?.id) !== String(id));
  if (next.length === cur.length) return false;
  __histCache = next;
  emitReloaded('user-remove', { id });
  return true;
}

export function getById(id) {
  return getHistoryLibrary().find(r => String(r?.id) === String(id)) || null;
}

export function resolveObject(hint = {}) {
  const list = getHistoryLibrary();
  if (!Array.isArray(list) || !list.length) return null;

  const lang = normalizeLang(hint.lang) || currentLang();
  const pickName = (rec) => pickLocalized(rec, 'name', lang);

  if (hint.id) {
    const byId = getById(hint.id);
    if (byId) return byId;
  }

  const catKey = hint.category_key || hint.category_id || null;
  const nameLow = low(hint.name);
  if (catKey && nameLow) {
    const hit = list.find(rec =>
      (rec?.category_key === catKey || rec?.category_id === catKey) &&
      low(pickName(rec)) === nameLow
    );
    if (hit) return hit;
  }

  if (nameLow) {
    const hit = list.find(rec => low(pickName(rec)) === nameLow);
    if (hit) return hit;
  }

  return null;
}

/** ───────────────────────────── Категорії для селектора ─────────────────────────────
 * Повертає масив категорій у форматі:
 *   { key, name_i18n: { ua, en, es }, isUser }
 * - Читає лише з кешу (await loadHistoryLibrary() → getHistoryLibrary()).
 * - Групування строго за category_key.
 * - isUser === true, якщо для key немає жодного запису з is_official===true.
 * - Порядок — за першою появою key у кеші (стабільний), тай-брейк — по key.
 */
export async function listCategories(/* mode='history' */) {
  await loadHistoryLibrary();
  const list = getHistoryLibrary();

  const byKey = new Map(); // key -> { key, name_i18n, isUser }
  const order = [];        // порядок першої появи

  for (const rec of Array.isArray(list) ? list : []) {
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
        isUser: rec?.is_official ? false : true
      };
      byKey.set(key, entry);
      order.push(key);
    } else {
      // дозаповнити локалізовані назви, якщо бракує
      if (!entry.name_i18n.ua && rec?.category_ua) entry.name_i18n.ua = S(rec.category_ua);
      if (!entry.name_i18n.en && rec?.category_en) entry.name_i18n.en = S(rec.category_en);
      if (!entry.name_i18n.es && rec?.category_es) entry.name_i18n.es = S(rec.category_es);
      // якщо зустріли офіційний запис — категорія офіційна
      if (rec?.is_official) entry.isUser = false;
    }
  }

  const out = order.map(k => byKey.get(k)).filter(Boolean);
  out.sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    if (ia !== ib) return ia - ib;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  return out;
}
