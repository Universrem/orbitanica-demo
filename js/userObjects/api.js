// /js/userObjects/api.js
// Стор користувацьких об'єктів.
// ВАЖЛИВО: getStore().list(mode) — СИНХРОННО повертає МАСИВ.
// Об'єкти показуються завжди; якщо немає перекладу поточною мовою — беремо будь-яку з наявних (ua/en/es) без пріоритету англійської.

'use strict';

import {
  listPublic,
  listMine,
  upsert as cloudUpsert,
  remove as cloudRemove
} from '/cabinet/js/cloud/userObjects.cloud.js';

// Єдине джерело правди для мови (існуючий API, не змінюємо i18n.js)
import { getCurrentLang } from '/js/i18n.js';

// ─────────────────────────────────────────────────────────────
// Події

function createEmitter() {
  const handlers = new Set();
  return {
    on(h) { if (typeof h === 'function') { handlers.add(h); return () => handlers.delete(h); } return () => {}; },
    emit(payload) { handlers.forEach(h => { try { h(payload); } catch {} }); },
    clear() { handlers.clear(); }
  };
}
const emitter = createEmitter();

function domEvent(name, detail) {
  try {
    const evt = new CustomEvent(name, { detail });
    document.dispatchEvent(evt); window.dispatchEvent(evt);
  } catch {}
}
function notify(type, payload) {
  const m = { added:'user-objects-added', changed:'user-objects-changed', removed:'user-objects-removed' };
  emitter.emit({ type, payload }); domEvent(m[type] || 'user-objects-changed', payload);
}

// ─────────────────────────────────────────────────────────────
// Мова + нормалізація

const norm = v => (v == null ? '' : String(v).trim());

// Алфавіт за кодом: en, es, ua
const ALL_LANGS = ['en','es','ua'];

function currentLang() {
  // Контролюємо лише три мови, без "uk"
  const l = (getCurrentLang && typeof getCurrentLang === 'function')
    ? String(getCurrentLang()).toLowerCase()
    : 'ua';
  if (l === 'en' || l === 'es') return l;
  return 'ua';
}

// Порядок пошуку значень: поточна → інші (алфавітно за кодом)
function langsOrder(curr) {
  const c = (curr || 'ua').toLowerCase();
  return [c, ...ALL_LANGS.filter(x => x !== c)];
}

// Узагальнений пікер для полів *_ua/*_en/*_es
function pickFieldTriplet(row, base, curr) {
  const order = langsOrder(curr);
  for (const L of order) {
    const v = norm(row[`${base}_${L}`]);
    if (v) return v;
  }
  // як крайній фолбек — нейтральне поле без суфікса (якщо колись з'явиться)
  return norm(row[base]);
}

// Пакуємо i18n-мішок для зручності споживачів
function packI18n(row, base) {
  return {
    ua: norm(row[`${base}_ua`]) || null,
    en: norm(row[`${base}_en`]) || null,
    es: norm(row[`${base}_es`]) || null
  };
}

function pickOriginalLang(row) {
  if (norm(row.name_ua)) return 'ua';
  if (norm(row.name_en)) return 'en';
  if (norm(row.name_es)) return 'es';
  return null;
}

/** Перетворюємо рядок із БД у формат, який чекають списки/блоки */
function normalizeRow(row) {
  const lang = currentLang();

  const name = pickFieldTriplet(row, 'name', lang);
  const category = pickFieldTriplet(row, 'category', lang);
  const description = pickFieldTriplet(row, 'description', lang);

  const out = {
    id: row.id,
    mode: row.mode,
    is_public: !!row.is_public,
    owner_id: row.owner_id,

    // назви
    name,
    name_i18n: packI18n(row, 'name'),
    originalLang: pickOriginalLang(row),

    // категорія: підпис завжди назвою (без ключа)
    category,
    category_i18n: packI18n(row, 'category'),
    category_key: norm(row.category_key) || null, // зберігаємо для логіки, але НЕ показуємо користувачу

    // опис
    description,
    description_i18n: packI18n(row, 'description'),

    // числові поля/одиниці (як є)
    value: row.value,
    value2: row.value2,
    unit_key: row.unit_key || null,
    unit2_key: row.unit2_key || null,

    // додаткове
    tags: row.tags || null,
    source_url: row.source_url || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
  return out;
}

function normalizeList(rows) {
  const arr = Array.isArray(rows) ? rows : [];
  const out = [];
  for (const r of arr) {
    const x = normalizeRow(r);
    if (x) out.push(x);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Кеш + ready()

const cache = new Map(); // mode -> { items:[], loaded:bool, loading:bool, scope:'all'|'mine'|'public' }
const readyOnce = new Map(); // mode -> Promise (резолвиться при першому успішному завантаженні)

function entry(mode) {
  if (!cache.has(mode)) cache.set(mode, { items: [], loaded: false, loading: false, scope: 'all' });
  return cache.get(mode);
}

function ensureReadyPromise(mode) {
  if (readyOnce.has(mode)) return readyOnce.get(mode);
  let resolveFn;
  const p = new Promise(res => { resolveFn = res; });
  p.__resolve = resolveFn;
  readyOnce.set(mode, p);
  return p;
}

function resolveReady(mode) {
  const p = ensureReadyPromise(mode);
  if (typeof p.__resolve === 'function') {
    p.__resolve();
    p.__resolve = null;
  }
}

function mergeUnique(a = [], b = []) {
  const res = [], seen = new Set();
  const add = x => {
    if (!x) return;
    const id = x.id ?? `${x.mode}:${x.name}:${x.category_key}`;
    if (seen.has(id)) return;
    seen.add(id);
    res.push(x);
  };
  (Array.isArray(a) ? a : []).forEach(add);
  (Array.isArray(b) ? b : []).forEach(add);
  return res;
}

// Скидання кешу під зміну мови
function invalidateAllCachesAndReload() {
  try {
    for (const [mode, e] of cache.entries()) {
      e.loaded = false;
      e.items = [];
      // Перезавантажуємо у фоні з поточним scope
      load(mode, e.scope || 'all', 200);
    }
    domEvent('user-objects:lang-changed', { lang: currentLang() });
  } catch {}
}

// Підписки на зміну мови (без змін у i18n.js)
try {
  document.addEventListener('languageChanged', () => {
    invalidateAllCachesAndReload();
  });
  window.addEventListener('orbit:lang-change', () => {
    invalidateAllCachesAndReload();
  });
} catch {}

// Фонове завантаження у кеш
async function load(mode, scope = 'all', limit = 200) {
  const e = entry(mode);
  if (e.loading) return;
  e.loading = true;

  try {
    if (scope === 'public') {
      const pkg = await listPublic(mode, limit, null);
      e.items  = normalizeList(pkg?.items);
      e.scope  = 'public';
      e.loaded = true;
      notify('changed', { mode, scope: 'public' });
      resolveReady(mode);
      domEvent('user-objects:loaded', { mode, scope: 'public' });
      return;
    }
    if (scope === 'mine') {
      const pkg = await listMine(mode, limit, null);
      e.items  = normalizeList(pkg?.items);
      e.scope  = 'mine';
      e.loaded = true;
      notify('changed', { mode, scope: 'mine' });
      resolveReady(mode);
      domEvent('user-objects:loaded', { mode, scope: 'mine' });
      return;
    }
    // 'all'
    const [minePkg, pubPkg] = await Promise.all([
      listMine(mode, limit, null).catch(() => ({ items: [] })),
      listPublic(mode, limit, null).catch(() => ({ items: [] }))
    ]);
    e.items  = mergeUnique(normalizeList(minePkg?.items), normalizeList(pubPkg?.items));
    e.scope  = 'all';
    e.loaded = true;
    notify('changed', { mode, scope: 'all' });
    resolveReady(mode);
    domEvent('user-objects:loaded', { mode, scope: 'all' });
  } catch (err) {
    console.error('[userObjects] load failed', err);
  } finally {
    e.loading = false;
  }
}

/** Детермінований бар’єр: резолвиться після ПЕРШОГО успішного load(mode, ...) */
export async function ready(mode) {
  if (!mode) throw new Error('[userObjects] mode is required');
  const e = entry(mode);
  if (!e.loaded && !e.loading) {
    load(mode, 'all', 200);
  }
  const p = ensureReadyPromise(mode);
  return p;
}

// ─────────────────────────────────────────────────────────────
// Публічні функції

/** СИНХРОННО: повертає масив із кешу; якщо треба — підвантажує у фоні */
export function list(mode, options = {}) {
  const scope    = options.scope || 'all';
  const limit    = Number.isFinite(options.limit) ? options.limit : 200;
  const autoload = options.autoload !== false;

  const e = entry(mode);

  if (autoload && (!e.loaded || e.scope !== scope) && !e.loading) {
    load(mode, scope, limit);
  }

  return Array.isArray(e.items) ? e.items : [];
}

/** Потрібні сторінки? — окремо, асинхронно */
export async function listPaged(mode, options = {}) {
  const scope  = options.scope || 'public';
  const limit  = Number.isFinite(options.limit) ? options.limit : 50;
  const cursor = options.cursor ?? null;

  if (scope === 'mine')   return await listMine(mode, limit, cursor);
  if (scope === 'public') return await listPublic(mode, limit, cursor);

  const [minePkg, pubPkg] = await Promise.all([
    listMine(mode, limit, cursor).catch(() => ({ items: [] })),
    listPublic(mode, limit, cursor).catch(() => ({ items: [] }))
  ]);
  return { items: mergeUnique(minePkg?.items, pubPkg?.items), nextCursor: null };
}

/** Додати/оновити — оновлюємо кеш і шлемо події */
export async function add(obj) {
  const row = await cloudUpsert(obj);       // повертає "сирий" рядок із БД
  const mode = row?.mode || obj?.mode;
  const e = mode ? entry(mode) : null;

  // Вставляємо у кеш миттєво (без мовного фільтру — він видалений)
  const n = normalizeRow(row);
  if (e && n) {
    const idx = e.items.findIndex(x => x.id === n.id);
    if (idx >= 0) e.items.splice(idx, 1, n);
    else e.items.unshift(n);
    notify(obj?.id ? 'changed' : 'added', n);
  } else {
    notify(obj?.id ? 'changed' : 'added', row);
  }

  // Негайне оновлення univers_lib для миттєвого доступу
  if (mode && (row || obj)) {
    try {
      const { addToUniversLibrary } = await import('../../js/data/univers_lib.js');
      addToUniversLibrary(mode, row || obj);
    } catch (error) {
      console.warn('[userObjects] Failed to update univers_lib:', error);
    }
  }
  // Сигналізуємо лібові/блокам
  if (mode) {
    domEvent('univers-lib-reloaded', { mode, reason: 'user-add', id: row?.id });
  }

  // Підтягнемо з хмари актуальний список (на випадок політик/курсорів)
  if (mode) load(mode, (e?.scope || 'all'));

  return row;
}

/** Видалити — чистимо кеш і шлемо події */
export async function remove(id, modeHint) {
  await cloudRemove(id);
  if (modeHint) {
    const e = entry(modeHint);
    if (e) e.items = e.items.filter(x => x.id !== id);
    notify('removed', { id });
    domEvent('univers-lib-reloaded', { mode: modeHint, reason: 'user-remove', id });
    load(modeHint, (e?.scope || 'all'));
  } else {
    notify('removed', { id });
  }
  return true;
}

/** onChange для внутрішніх слухачів */
export function onChange(handler) { return emitter.on(handler); }

/** Зручності */
export async function exportAll(mode, options = { scope: 'all', limit: 1000 }) {
  await load(mode, options.scope || 'all', options.limit || 1000);
  return list(mode, { scope: options.scope || 'all', autoload: false });
}
export async function importAll() { return false; }
export async function getByName(mode, name) {
  const want = norm(name).toLowerCase();
  await load(mode, 'all', 1000);
  const items = list(mode, { scope: 'all', autoload: false });
  return items.find(x => norm(x?.name).toLowerCase() === want);
}

/** Публічний стор */
export function getStore() {
  return { list, listPaged, add, remove, onChange, exportAll, importAll, getByName, ready };
}
export default { getStore, ready };
