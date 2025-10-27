// /js/data/money_lib.js
'use strict';

/**
 * Еталонний лоадер бібліотеки для режиму «Гроші» за аналогією з univers_lib (Діаметри).
 *
 * Функціонал:
 *  - Офіційні записи з /data/money.json + користувацькі (Supabase) для mode==='money'.
 *  - Нормалізація до уніфікованого формату:
 *      { id, category_key, name_*, description_*, money: { value, unit }, is_official|is_user_object, ... }
 *  - Кешування, бар’єр готовності, миттєві add/remove з подіями для UI.
 *
 * Публічне API:
 *   await loadMoneyLibrary()
 *   await readyMoney()                   // одноразовий бар’єр готовності кешу
 *   getMoneyLibrary()                    // змерджений масив (може бути порожнім)
 *   await refreshMoneyLibrary()          // перезавантажити (і кине подію)
 *   addToMoneyLibrary(userRow)           // миттєво додати/замінити один UGC-запис (і кине подію)
 *   removeFromMoneyLibrary(id)           // миттєво видалити UGC-запис за id (і кине подію)
 *   getMoneyById(id)                     // знайти запис у кеші
 *   resolveMoneyObject(hint)             // { id?, category_key?, name?, lang? } → запис або null
 */

import { listPublic, listMine } from '../../cabinet/js/cloud/userObjects.cloud.js';

/* ───────────────────────────── Константи та кеш ───────────────────────────── */

const MODE = 'money';
const MODE_FIELD = 'money'; // ключ режимного поля у нормалізованому записі

let __cache = [];                // змерджена бібліотека (офіційні + UGC), уже нормалізована
let __promise = null;            // єдиний проміс завантаження (щоби не було гонок)
let __readyOnce = null;          // одноразовий бар’єр готовності (Promise<void>)

/* ───────────────────────────── Мова та утиліти ───────────────────────────── */

const LANGS = ['en', 'es', 'ua'];
const norm = (s) => String(s ?? '').trim();
const low = (s) => norm(s).toLowerCase();

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
      (typeof document !== 'undefined' && (document.documentElement?.getAttribute('lang') || '')) ||
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

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, '0');
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

function makeStableIdForOfficial(rec) {
  const lang = currentLang();
  const name = pickLocalized(rec, 'name', lang) || pickLocalized(rec, 'name', 'en') || '';
  const cat  = pickLocalized(rec, 'category', lang) || pickLocalized(rec, 'category', 'en') || '';
  const key  = String(rec?.category_key || rec?.category_id || '').trim();
  const basis = `${MODE}|${key}|${low(name)}|${low(cat)}`;
  return `off-${MODE}-${djb2(basis)}`;
}

/* ───────────────────── Нормалізація UGC → формат бібліотеки ──────────────────── */

function normalizeUserObject(row) {
  if (!row || row?.mode !== MODE) return null;

  // Значення
  const rawVal =
    row.value ?? row.value1 ?? row.amount ?? row.money ?? row.money_value ?? row.value_usd;
  const v = Number(rawVal);
  if (!Number.isFinite(v) || v <= 0) return null;

  // Одиниця (валюта)
  const rawUnit = row.unit_key ?? row.unit ?? row.currency ?? row.money_unit ?? row.unit1_key ?? row.unit1;
  const unit = rawUnit ? String(rawUnit).trim() : null;

  const rec = {
    source: 'user',
    is_user_object: true,
    is_official: false,

    id: row.id,
    user_id: row.owner_id,

    category_key: row.category_key,
    category_id: row.category_key, // зворотна сумісність

    name_ua: row.name_ua, name_en: row.name_en, name_es: row.name_es,
    category_ua: row.category_ua, category_en: row.category_en, category_es: row.category_es,
    description_ua: row.description_ua, description_en: row.description_en, description_es: row.description_es,

    [MODE_FIELD]: { value: v, unit },

    curated: !!row.curated,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  return rec;
}

/* ───────────────────── Нормалізація OFFICIAL → формат бібліотеки ───────────────────── */

function normalizeOfficial(rec) {
  if (!rec) return null;

  // 1) Значення та валюта (максимально терпимі до формату)
  const rawV = rec?.[MODE_FIELD]?.value ?? rec?.[MODE_FIELD] ?? rec?.amount ?? rec?.value;
  const rawU = rec?.[MODE_FIELD]?.unit ?? rec?.currency ?? rec?.unit;
  const v = Number(rawV);
  if (!Number.isFinite(v) || v <= 0) return null;
  const unit = rawU ? String(rawU).trim() : null;

  // 2) Категорія + id
  const category_key = ensureCategoryKey(rec);
  const id = norm(rec?.id) || makeStableIdForOfficial({ ...rec, category_key });

  const out = {
    source: 'official',
    is_user_object: false,
    is_official: true,

    id,
    category_key,
    category_id: category_key, // зворотна сумісність

    name_ua: rec?.name_ua, name_en: rec?.name_en, name_es: rec?.name_es,
    category_ua: rec?.category_ua, category_en: rec?.category_en, category_es: rec?.category_es,
    description_ua: rec?.description_ua, description_en: rec?.description_en, description_es: rec?.description_es,

    [MODE_FIELD]: { value: v, unit },
  };

  return out;
}

/* ───────────────────────────── Завантаження ───────────────────────────── */

async function fetchOfficial() {
  const url = '/data/money.json';
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    console.error('[money_lib] network error', e);
    throw new Error('[money_lib] failed to fetch money.json');
  }
  if (!res.ok) throw new Error(`[money_lib] HTTP ${res.status} for ${url}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('[money_lib] money.json must be an array of records');
  return data;
}

async function fetchUserByMode() {
  const LIMIT = 500;
  const [mineRes, pubRes] = await Promise.all([
    listMine(MODE, LIMIT, null),
    listPublic(MODE, LIMIT, null),
  ]);

  const mine = Array.isArray(mineRes?.items) ? mineRes.items : [];
  const pub  = Array.isArray(pubRes?.items)  ? pubRes.items  : [];

  // уникаємо дублів за id
  const seenIds = new Set(mine.map(it => it?.id).filter(Boolean));
  const pubFiltered = pub.filter(it => it && !seenIds.has(it.id));

  // нормалізація
  const all = [...mine, ...pubFiltered]
    .map(row => normalizeUserObject(row))
    .filter(Boolean);

  return all;
}

function dedupeMerge(officialNorm, userNorm) {
  // офіційні → індекс за id, поверх кладемо UGC (UGC має пріоритет за тим самим id)
  const byId = new Map();
  for (const r of officialNorm) {
    if (!r?.id) continue;
    byId.set(String(r.id), r);
  }
  for (const u of userNorm) {
    if (!u?.id) continue;
    byId.set(String(u.id), u);
  }
  return Array.from(byId.values());
}

async function build() {
  const [officialRaw, userObjs] = await Promise.all([
    fetchOfficial(),
    fetchUserByMode(),
  ]);

  const officialNorm = officialRaw.map(r => normalizeOfficial(r)).filter(Boolean);
  const userNorm = userObjs;

  return dedupeMerge(officialNorm, userNorm);
}

/* ───────────────────────────── Події ───────────────────────────── */

function emitReady(reason = 'ready') {
  try {
    const evName = `money-lib:ready`;
    const detail = { mode: MODE, reason };
    window.dispatchEvent(new CustomEvent(evName, { detail }));
    document.dispatchEvent(new CustomEvent(evName, { detail }));
  } catch {}
}

function emitReloaded(reason, extra = {}) {
  try {
    const detail = { mode: MODE, reason, ...extra };
    window.dispatchEvent(new CustomEvent('money-lib-reloaded', { detail }));
    document.dispatchEvent(new CustomEvent('money-lib-reloaded', { detail }));
  } catch {}
}

/* ───────────────────────────── Публічні API ───────────────────────────── */

export async function loadMoneyLibrary() {
  if (__promise) return __promise;

  __promise = (async () => {
    const merged = await build();
    __cache = merged;

    if (!__readyOnce) {
      let resolveReady;
      __readyOnce = new Promise(res => { resolveReady = res; });
      resolveReady(); // кеш уже зібрано
      emitReady('first-load');
    } else {
      emitReady('reload');
    }
  })();

  return __promise;
}

export async function readyMoney() {
  if (!__cache.length && !__promise) {
    await loadMoneyLibrary();
  }
  if (__readyOnce) return __readyOnce;
  let resolveReady;
  __readyOnce = new Promise(res => { resolveReady = res; });
  resolveReady();
  return __readyOnce;
}

export function getMoneyLibrary() {
  return __cache || [];
}

export async function refreshMoneyLibrary() {
  __promise = null;
  __cache = [];
  await loadMoneyLibrary();
  emitReloaded('refresh');
}

/**
 * Миттєво додати/оновити UGC-запис у кеші.
 * Повертає нормалізований запис або null.
 */
export function addToMoneyLibrary(userRow) {
  if (!userRow) return null;
  const normalized = normalizeUserObject(userRow);
  if (!normalized) return null;

  const cur = Array.isArray(__cache) ? [...__cache] : [];
  const next = cur.filter(item => String(item?.id) !== String(normalized.id));
  next.unshift(normalized);

  __cache = next;
  emitReloaded('user-add', { id: normalized.id });
  return normalized;
}

/** Миттєво видалити UGC-запис із кешу. */
export function removeFromMoneyLibrary(id) {
  if (!id) return false;
  const cur = Array.isArray(__cache) ? __cache : [];
  const next = cur.filter(it => String(it?.id) !== String(id));
  if (next.length === cur.length) return false;
  __cache = next;
  emitReloaded('user-remove', { id });
  return true;
}

/** Пошук у кеші за стабільним id. */
export function getMoneyById(id) {
  if (!id) return null;
  if (!Array.isArray(__cache)) return null;
  return __cache.find(it => String(it?.id) === String(id)) || null;
}

/**
 * Резолвер об’єкта за підказкою: { id?, category_key?, name?, lang? }.
 * Пріоритет: id → (category_key + name) → name.
 */
export function resolveMoneyObject(hint = {}) {
  const list = Array.isArray(__cache) ? __cache : [];
  if (!list.length) return null;

  const lang = normalizeLang(hint.lang) || currentLang();
  const pickName = (rec) => pickLocalized(rec, 'name', lang);

  if (hint.id) {
    const byId = getMoneyById(hint.id);
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

/* ───────────────────────── Глобальні слухачі UGC-подій ─────────────────────────
   Очікувані detail-поля:
     user-objects-updated: { mode, object }   // object — сирий рядок із Supabase
     user-objects-removed: { mode, id }       // id — UUID/PK
*/

function __onUserObjectUpdated(e) {
  try {
    const d = e?.detail || {};
    if (d.mode !== MODE || !d.object) return;
    addToMoneyLibrary(d.object);
  } catch (err) {
    console.warn('[money_lib] user-objects-updated handler:', err);
  }
}

function __onUserObjectRemoved(e) {
  try {
    const d = e?.detail || {};
    if (d.mode !== MODE || !d.id) return;
    removeFromMoneyLibrary(d.id);
  } catch (err) {
    console.warn('[money_lib] user-objects-removed handler:', err);
  }
}

// Реєстрація (один раз)
try {
  window.addEventListener('user-objects-updated', __onUserObjectUpdated);
  document.addEventListener('user-objects-updated', __onUserObjectUpdated);

  window.addEventListener('user-objects-removed', __onUserObjectRemoved);
  document.addEventListener('user-objects-removed', __onUserObjectRemoved);
} catch {}
