// /js/data/math_lib.js
'use strict';

/**
 * Лоадер бібліотеки для режиму «Математика» — snapshot-first friendly (аналог «Діаметри»).
 * Офіційні (/data/mathematics.json) + UGC (Supabase), уніфіковані в один формат:
 *   { id, category_key, name_*, description_*, math: { value, unit } }
 *
 * Публічні API:
 *   await loadMathLibrary()
 *   await readyMathLibrary()
 *   getMathLibrary()
 *   await refreshMathLibrary()
 *   addToMathLibrary(userRow)     // миттєво додати/оновити UGC у кеші
 *   removeFromMathLibrary(id)     // миттєво прибрати UGC з кешу
 *   getById(id)
 *   resolveObject({ id, category_key, name, lang })
 */

import { listPublic, listMine } from '/cabinet/js/cloud/userObjects.cloud.js';

/* ───────────────────────────── Стала ───────────────────────────── */

const MODE = 'math';           // ім'я режиму в Supabase
const MODE_FIELD = 'math';     // режимне поле з { value, unit } для snapshot

/* ───────────────────────────── Сховище ───────────────────────────── */

let __cache = [];              // масив нормалізованих записів (офіційні + UGC)
let __promise = null;          // спільний проміс завантаження
let __readyOnce = null;        // бар'єр "кеш хоч раз готовий"

/* ───────────────────────────── Мова та утиліти ───────────────────────────── */

const LANGS = ['en','es','ua'];
const norm = v => String(v ?? '').trim();
const low  = v => norm(v).toLowerCase();

function normalizeLang(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s.startsWith('ua')) return 'ua';
  if (s.startsWith('en')) return 'en';
  if (s.startsWith('es')) return 'es';
  return '';
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
    return normalizeLang(cand) || 'ua';
  } catch { return 'ua'; }
}
function langsOrder(curr) {
  const c = (curr || 'ua').toLowerCase();
  return [c, ...LANGS.filter(x => x !== c)];
}
function pickLocalized(src, base, lang) {
  const order = langsOrder(lang);
  for (const L of order) {
    const v = norm(src?.[`${base}_${L}`]);
    if (v) return v;
  }
  return norm(src?.[base]);
}

/* ───────────────────────────── Ідентифікатори ───────────────────────────── */

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, '0');
}
function makeStableIdForOfficial(rec) {
  const lang = currentLang();
  const name = pickLocalized(rec, 'name', lang) || pickLocalized(rec, 'name', 'en') || '';
  const cat  = pickLocalized(rec, 'category', lang) || pickLocalized(rec, 'category', 'en') || '';
  const key  = String(rec?.category_key || rec?.category_id || '').trim();
  const basis = `${MODE}|${key}|${low(name)}|${low(cat)}`;
  return `off-${MODE}-${djb2(basis)}`;
}
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

function normalizeUserRow(row) {
  if (!row || row.mode !== MODE) return null;

  // Значення/одиниця — допускаємо різні сирі поля
  const rawVal =
    row.value ?? row.value1 ?? row.amount ?? row.number ?? row[MODE_FIELD]?.value;

  const rawUnit =
    row.unit_key ?? row.unit ?? row.unit1_key ?? row.unit1 ?? row[MODE_FIELD]?.unit ?? 'unit';

  const v = Number(rawVal);
  if (!Number.isFinite(v) || v <= 0) return null;

  return {
    source: 'user',
    is_user_object: true,
    user_id: row.owner_id,

    id: row.id,
    category_key: row.category_key,
    category_id: row.category_key,

    name_ua: row.name_ua, name_en: row.name_en, name_es: row.name_es,
    category_ua: row.category_ua, category_en: row.category_en, category_es: row.category_es,
    description_ua: row.description_ua, description_en: row.description_en, description_es: row.description_es,

    [MODE_FIELD]: { value: v, unit: String(rawUnit) || 'unit' },

    curated: !!row.curated,
    is_official: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}


/* ─────────────────────── Нормалізація OFFICIAL → формат бібліотеки ─────────────────────── */

function normalizeOfficial(rec) {
  if (!rec) return null;

  // OFFICIAL: основне джерело — quantity { value, unit } із mathematics.json
  const rawV =
    rec?.quantity?.value ??
    rec?.quantity ??
    rec?.[MODE_FIELD]?.value ??
    rec?.[MODE_FIELD] ??
    rec?.value ?? rec?.number ?? rec?.amount;

  const rawU =
    rec?.quantity?.unit ??
    rec?.[MODE_FIELD]?.unit ??
    rec?.unit ?? 'unit';

  const v = Number(rawV);
  if (!Number.isFinite(v) || v <= 0) return null;

  const category_key = ensureCategoryKey(rec);
  const id = norm(rec?.id) || makeStableIdForOfficial({ ...rec, category_key });

  return {
    source: 'official',
    is_user_object: false,

    id,
    category_key,
    category_id: category_key,

    name_ua: rec?.name_ua, name_en: rec?.name_en, name_es: rec?.name_es,
    category_ua: rec?.category_ua, category_en: rec?.category_en, category_es: rec?.category_es,
    description_ua: rec?.description_ua, description_en: rec?.description_en, description_es: rec?.description_es,

    [MODE_FIELD]: { value: v, unit: String(rawU) || 'unit' },

    is_official: true
  };
}


/* ───────────────────────────── Завантаження ───────────────────────────── */

async function fetchOfficial() {
  const url = '/data/mathematics.json';
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    console.error('[math_lib] network error', e);
    throw new Error('[math_lib] failed to fetch mathematics.json');
  }
  if (!res.ok) throw new Error(`[math_lib] HTTP ${res.status} for ${url}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('[math_lib] mathematics.json must be an array of records');
  return data;
}

async function fetchUserUGC() {
  const LIMIT = 500;
  const [mineRes, pubRes] = await Promise.all([
    listMine(MODE, LIMIT, null),
    listPublic(MODE, LIMIT, null),
  ]);

  const mine = Array.isArray(mineRes?.items) ? mineRes.items : [];
  const pub  = Array.isArray(pubRes?.items)  ? pubRes.items  : [];

  const seen = new Set(mine.map(it => it?.id).filter(Boolean));
  const pubFiltered = pub.filter(it => it && !seen.has(it.id));

  return [...mine, ...pubFiltered].map(normalizeUserRow).filter(Boolean);
}

function mergeById(officialNorm, userNorm) {
  const byId = new Map();
  for (const r of officialNorm) if (r?.id) byId.set(String(r.id), r);
  for (const u of userNorm)     if (u?.id) byId.set(String(u.id), u); // UGC має пріоритет за тим самим id
  return [...byId.values()];
}

async function build() {
  const [officialRaw, userObjs] = await Promise.all([
    fetchOfficial(),
    fetchUserUGC(),
  ]);

  const officialNorm = officialRaw.map(normalizeOfficial).filter(Boolean);
  return mergeById(officialNorm, userObjs);
}

/* ───────────────────────────── Події ───────────────────────────── */

function emitReady(reason = 'ready') {
  try {
    const ev = new CustomEvent('math-lib-ready', { detail: { reason } });
    window.dispatchEvent(ev); document.dispatchEvent(ev);
  } catch {}
}
function emitReloaded(reason, extra = {}) {
  try {
    const ev = new CustomEvent('math-lib-reloaded', { detail: { reason, ...extra } });
    window.dispatchEvent(ev); document.dispatchEvent(ev);
  } catch {}
}

/* ───────────────────────────── Публічні API ───────────────────────────── */

export async function loadMathLibrary() {
  if (__promise) return __promise;

  __promise = (async () => {
    __cache = await build();

    if (!__readyOnce) {
      let resolveReady;
      __readyOnce = new Promise(res => { resolveReady = res; });
      resolveReady();
      emitReady('first-load');
    } else {
      emitReady('reload');
    }
  })();

  return __promise;
}

export async function readyMathLibrary() {
  if (!__cache.length && !__promise) {
    await loadMathLibrary();
  }
  if (__readyOnce) return __readyOnce;
  let resolveReady;
  __readyOnce = new Promise(res => { resolveReady = res; });
  resolveReady();
  return __readyOnce;
}

export function getMathLibrary() {
  return __cache || [];
}

export async function refreshMathLibrary() {
  __promise = null;
  __cache = [];
  await loadMathLibrary();
  emitReloaded('refresh');
}

export function addToMathLibrary(userRow) {
  const normalized = normalizeUserRow(userRow);
  if (!normalized) return null;

  const next = (Array.isArray(__cache) ? __cache : []).filter(it => String(it?.id) !== String(normalized.id));
  next.unshift(normalized);
  __cache = next;
  emitReloaded('user-add', { id: normalized.id });
  return normalized;
}

export function removeFromMathLibrary(id) {
  if (!id) return false;
  const cur = Array.isArray(__cache) ? __cache : [];
  const next = cur.filter(it => String(it?.id) !== String(id));
  if (next.length === cur.length) return false;
  __cache = next;
  emitReloaded('user-remove', { id });
  return true;
}

export function getById(id) {
  if (!id) return null;
  return (Array.isArray(__cache) ? __cache : []).find(it => String(it?.id) === String(id)) || null;
}

export function resolveObject(hint = {}) {
  const list = Array.isArray(__cache) ? __cache : [];
  if (!list.length) return null;

  const lang = normalizeLang(hint.lang) || currentLang();
  const pickName = (rec) => pickLocalized(rec, 'name', lang);

  if (hint.id) {
    const byId = getById(hint.id);
    if (byId) return byId;
  }

  const catKey = hint.category_key ?? hint.category_id ?? null;
  const hintNameLow = low(hint.name);
  if (catKey && hintNameLow) {
    const found = list.find(rec =>
      (rec?.category_key === catKey || rec?.category_id === catKey) &&
      low(pickName(rec)) === hintNameLow
    );
    if (found) return found;
  }

  if (hintNameLow) {
    const found = list.find(rec => low(pickName(rec)) === hintNameLow);
    if (found) return found;
  }

  return null;
}

/* ───────────────────────────── Реакція на глобальні події UGC ───────────────────────────── */

function onUserObjectsUpdated(e) {
  try {
    const d = e?.detail || {};
    if (d.mode !== MODE || !d.object) return;
    addToMathLibrary(d.object);
  } catch (err) {
    console.warn('[math_lib] user-objects-updated handler:', err);
  }
}
function onUserObjectsRemoved(e) {
  try {
    const d = e?.detail || {};
    if (d.mode !== MODE || !d.id) return;
    removeFromMathLibrary(d.id);
  } catch (err) {
    console.warn('[math_lib] user-objects-removed handler:', err);
  }
}

try {
  window.addEventListener('user-objects-updated', onUserObjectsUpdated);
  document.addEventListener('user-objects-updated', onUserObjectsUpdated);
  window.addEventListener('user-objects-removed', onUserObjectsRemoved);
  document.addEventListener('user-objects-removed', onUserObjectsRemoved);
} catch {}
/** ───────────────────────────── Категорії для селектора ─────────────────────────────
 * Повертає масив категорій у форматі:
 *   { key, name_i18n: { ua, en, es }, isUser }
 * - Працює для режиму 'math'
 * - Читає лише з кешу (readyMathLibrary() → getMathLibrary()).
 * - Групування строго за category_key.
 * - isUser === true, якщо для key немає жодного запису з is_official===true.
 * - Порядок — за першою появою key у кеші (стабільний), тай-брейк — по key.
 */
export async function listCategories(mode = MODE) {
  if (mode && mode !== MODE) return [];

  await readyMathLibrary();
  const list = Array.isArray(getMathLibrary()) ? getMathLibrary() : [];

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
        // стартуємо з припущення "користувацька", скинемо до false якщо побачимо офіційний запис
        isUser: rec?.is_official ? false : true,
      };
      byKey.set(key, entry);
      order.push(key);
    } else {
      // дозаповнюємо локалізовані назви, якщо якісь порожні
      if (!entry.name_i18n.ua && rec?.category_ua) entry.name_i18n.ua = S(rec.category_ua);
      if (!entry.name_i18n.en && rec?.category_en) entry.name_i18n.en = S(rec.category_en);
      if (!entry.name_i18n.es && rec?.category_es) entry.name_i18n.es = S(rec.category_es);
      // якщо зустріли офіційний запис — категорія вважається офіційною
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
