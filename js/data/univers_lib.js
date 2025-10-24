// js/data/univers_lib.js
'use strict';

/**
 * Лоадер «Всесвіту» для конкретного режиму.
 * Віддає: офіційні + користувацькі (з Supabase) ТІЛЬКИ для запитаного mode.
 * Кеш окремо на кожен mode.
 *
 * Публічне API:
 *   await loadUniversLibrary(mode)          // 'distance' | 'diameter' | 'mass' | 'luminosity'
 *   await ready(mode)                       // детермінований бар'єр готовності кешу
 *   getUniversLibrary(mode)                 // отримати змерджений масив (може бути порожнім)
 *   await refreshUniversLibrary(mode)       // перезавантажити й надіслати подію
 *   addToUniversLibrary(mode, userRow)      // миттєво додати/замінити юзер-об’єкт у кеші (і кинути подію)
 *   removeFromUniversLibrary(mode, id)      // миттєво видалити юзер-об’єкт із кешу (і кинути подію)
 *   getById(mode, id)                       // знайти запис у кеші за id (user/official)
 *   resolveObject(mode, hint)               // розв’язати об’єкт за {id, category_key, name, lang}
 */

import { listPublic, listMine } from '../../cabinet/js/cloud/userObjects.cloud.js';

const MODE_FIELD = {
  distance:   'distance_to_earth',
  diameter:   'diameter',
  mass:       'mass',
  luminosity: 'luminosity',
};

const __cache     = new Map();   // mode -> array (мердж офіційні + юзерські)
const __promises  = new Map();   // mode -> Promise завантаження
const __readyOnce = new Map();   // mode -> Promise, що резолвиться при першому готовому кеші

/* ───────────────────────────── Мова та утиліти ───────────────────────────── */

const LANGS = ['en','es','ua']; // алфавітно за кодом
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
  // як крайній фолбек — нейтральне поле без суфікса (якщо колись з'явиться)
  return norm(src?.[base]);
}

// Мовно-інваріантні “ключові” значення (для дедупу): беремо лексикографічний мінімум по наявних
function invariantMinOfTriplet(src, base) {
  const all = [norm(src?.[`${base}_ua`]), norm(src?.[`${base}_en`]), norm(src?.[`${base}_es`])]
    .filter(Boolean)
    .map(s => low(s));
  if (!all.length) return '';
  all.sort(); // лексикографічно (en/es/ua не важливо — важливий зміст)
  return all[0];
}

function hasModeField(rec, mode) {
  const key = MODE_FIELD[mode];
  if (!key) return false;
  const v = Number(rec?.[key]?.value ?? rec?.[key]); // офіційні можуть мати інакше
  return Number.isFinite(v) && v > 0;
}

/* ───────────────────────── Нормалізація UGC → формат бібліотеки ───────────────────────── */

function normalizeUserObject(row, mode) {
  if (!row || !mode || row?.mode !== mode) return null;

  const key = MODE_FIELD[mode];
  if (!key) return null;

  // значення та одиниця з сирого запису (UGC)
  const rawVal =
    row.value ?? row.value1 ??
    row.distance ?? row.diameter ?? row.mass ?? row.luminosity;

  const rawUnit = row.unit_key ?? row.unit ?? row.unit1_key ?? row.unit1;

  const v = Number(rawVal);
  if (!Number.isFinite(v) || v <= 0) return null;

  const lang = currentLang();

  const rec = {
    // ідентифікація
    id: row.id,
    source: 'user',
    is_user_object: true,
    user_id: row.owner_id,

    // оригінальні i18n-поля залишаємо як є
    name_ua: row.name_ua,
    name_en: row.name_en,
    name_es: row.name_es,

    category_ua: row.category_ua,
    category_en: row.category_en,
    category_es: row.category_es,

    description_ua: row.description_ua,
    description_en: row.description_en,
    description_es: row.description_es,

    // агреговані для зручності споживачів — за мовою системи з коректним фолбеком
    name:     pickLocalized(row, 'name',     lang),
    category: pickLocalized(row, 'category', lang),

    // ключ категорії
    category_key: row.category_key,
    category_id:  row.category_key, // зворотна сумісність

    // режимне поле
    [key]: {
      value: v,
      unit:  rawUnit ? String(rawUnit) : null,
    },

    // мета
    created_at: row.created_at,
    updated_at: row.updated_at,
    curated: !!row.curated,
    is_official: false,
  };

  return rec;
}

/* ───────────────────────────── Завантаження ───────────────────────────── */

async function fetchOfficial() {
  const url = '/data/univers.json';
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    console.error('[univers_lib] network error', e);
    throw new Error('[univers_lib] failed to fetch univers.json');
  }
  if (!res.ok) throw new Error(`[univers_lib] HTTP ${res.status} for ${url}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('[univers_lib] univers.json must be an array of records');
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

// Мовно-незалежний ключ унікальності (id → інакше інваріант назви/категорії + джерело)
function keyOfInvariant(r) {
  if (r?.id) return `id:${r.id}`;
  const n = invariantMinOfTriplet(r, 'name')     || low(r?.name)     || '';
  const c = invariantMinOfTriplet(r, 'category') || low(r?.category) || '';
  const s = r?.is_user_object ? 'u' : 'o';
  return `${s}|n:${n}|c:${c}`;
}

function dedupeMerge(official, user, mode) {
  // офіційні: тільки релевантні цьому режиму
  const offFiltered = official.filter(rec => hasModeField(rec, mode));

  // Стартовий набір + seen ключі
  const out  = [...offFiltered];
  const seen = new Set(out.map(keyOfInvariant));

  for (const u of user) {
    const k = keyOfInvariant(u);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(u);
    } else {
      // якщо id збігся — замінюємо на свіжий юзерський
      const idx = out.findIndex(r => (r.id && u.id) ? r.id === u.id : keyOfInvariant(r) === k);
      if (idx >= 0) out[idx] = u;
    }
  }

  return out;
}

async function buildForMode(mode) {
  const [official, userObjs] = await Promise.all([
    fetchOfficial(),
    fetchUserByMode(mode),
  ]);
  return dedupeMerge(official, userObjs, mode);
}

/* ───────────────────────────── Події ───────────────────────────── */

function emitReady(mode, reason = 'ready') {
  try {
    const evName = `univers-lib:ready:${mode}`;
    const detail = { mode, reason };
    window.dispatchEvent(new CustomEvent(evName, { detail }));
    document.dispatchEvent(new CustomEvent(evName, { detail }));
  } catch {}
}

function emitReloaded(mode, reason, extra = {}) {
  try {
    const detail = { mode, reason, ...extra };
    window.dispatchEvent(new CustomEvent('univers-lib-reloaded', { detail }));
    document.dispatchEvent(new CustomEvent('univers-lib-reloaded', { detail }));
  } catch {}
}

/* ───────────────────────────── Публічні API ───────────────────────────── */

export async function loadUniversLibrary(mode) {
  if (!mode) throw new Error('[univers_lib] mode is required');
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
export async function ready(mode) {
  if (!mode) throw new Error('[univers_lib] mode is required');
  // якщо кешу ще нема — стартуємо завантаження
  if (!__cache.has(mode) && !__promises.has(mode)) {
    await loadUniversLibrary(mode);
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

export async function refreshUniversLibrary(mode) {
  if (!mode) throw new Error('[univers_lib] mode is required');
  __promises.delete(mode);
  __cache.delete(mode);
  // readyOnce залишаємо — це бар’єр "один раз був готовий".
  await loadUniversLibrary(mode);
  emitReloaded(mode, 'refresh');
}

export function getUniversLibrary(mode) {
  return __cache.get(mode) || [];
}

/**
 * Миттєво додати/оновити юзер-об’єкт у кеші обраного режиму.
 * Викликати одразу після успішного створення/редагування в Supabase.
 * Повертає нормалізований запис або null.
 */
export function addToUniversLibrary(mode, userRow) {
  if (!mode || !userRow) return null;

  const normalized = normalizeUserObject(userRow, mode);
  if (!normalized) return null;

  const cur = Array.isArray(__cache.get(mode)) ? [...__cache.get(mode)] : [];

  // Видаляємо стару версію якщо існує (за id або інваріантним ключем)
  const nk = keyOfInvariant(normalized);
  const next = cur.filter(item => keyOfInvariant(item) !== nk);

  // Додаємо новий об'єкт на початок (щоб був помітний у списках)
  next.unshift(normalized);
  __cache.set(mode, next);

  emitReloaded(mode, 'user-add', { id: normalized.id });
  return normalized;
}

/**
 * Миттєво видалити юзер-об’єкт з кешу обраного режиму та кинути подію.
 */
export function removeFromUniversLibrary(mode, id) {
  if (!mode || !id) return false;
  const cur = Array.isArray(__cache.get(mode)) ? __cache.get(mode) : [];
  const next = cur.filter(it => it?.id !== id);
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
    addToUniversLibrary(d.mode, d.object);
  } catch(err) {
    console.warn('[univers_lib] user-objects-updated handler:', err);
  }
}

function __onUserObjectRemoved(e) {
  try {
    const d = e?.detail || {};
    if (!d.mode || !d.id) return;
    removeFromUniversLibrary(d.mode, d.id);
  } catch(err) {
    console.warn('[univers_lib] user-objects-removed handler:', err);
  }
}

// реєстрація (один раз)
try {
  window.addEventListener('user-objects-updated', __onUserObjectUpdated);
  document.addEventListener('user-objects-updated', __onUserObjectUpdated);

  window.addEventListener('user-objects-removed', __onUserObjectRemoved);
  document.addEventListener('user-objects-removed', __onUserObjectRemoved);
} catch {}
