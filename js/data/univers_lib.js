'use strict';

/**
 * Лоадер «Всесвіту» для конкретного режиму.
 * Віддає: офіційні + користувацькі (з Supabase) ТІЛЬКИ для запитаного mode.
 * Кеш окремо на кожен mode.
 *
 * Публічне API (збережено):
 *   await loadUniversLibrary(mode)          // 'distance' | 'diameter' | 'mass' | 'luminosity'
 *   await ready(mode)                       // детермінований бар'єр готовності кешу
 *   getUniversLibrary(mode)                 // отримати змерджений масив (може бути порожнім)
 *   await refreshUniversLibrary(mode)       // перезавантажити й надіслати подію
 *   addToUniversLibrary(mode, userRow)      // миттєво додати/замінити юзер-об’єкт у кеші (і кинути подію)
 *   removeFromUniversLibrary(mode, id)      // миттєво видалити юзер-об’єкт із кешу (і кинути подію)
 *   getById(mode, id)                       // знайти запис у кеші за id (user/official)
 *   resolveObject(mode, hint)               // розв’язати об’єкт за {id, category_key, name, lang}
 *
 * ВАЖЛИВО (fixed):
 *   1) Офіційні записи тепер НОРМАЛІЗУЮТЬСЯ так само, як користувацькі:
 *      гарантовано мають: { id, category_key, name_*, description_*, [modeField]: { value, unit } }.
 *   2) Якщо офіційний запис не містив id/category_key — генеруємо стабільний id і ключ категорії.
 *   3) Після цього селектори завжди отримують стабільні id → «Розрахувати» кладе будь-який О2 у буфер.
 */

import { listPublic, listMine } from '../../cabinet/js/cloud/userObjects.cloud.js';

const MODE_FIELD = {
  distance:   'distance_to_earth',
  diameter:   'diameter',
  mass:       'mass',
  luminosity: 'luminosity',
};

const __cache     = new Map();   // mode -> array (мердж офіційні + юзерські, вже нормалізовані)
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

/* ───────────────────────────── Ідентифікатори ───────────────────────────── */

// Детермінований простий хеш → стабільний псевдо-id для офіційних, якщо немає id
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  // до позитивного 32-bit і в hex
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
// Перевага: rec.category_key/rec.category_id → інакше із локалізованих назв будуємо slug
function ensureCategoryKey(rec) {
  const existed = norm(rec?.category_key || rec?.category_id);
  if (existed) return existed;
  const lang = currentLang();
  const label = pickLocalized(rec, 'category', lang) ||
                pickLocalized(rec, 'category', 'en') ||
                pickLocalized(rec, 'name', 'en') || 'misc';
  // грубий slug
  return low(label).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'misc';
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

  const rec = {
    // джерело
    source: 'user',
    is_user_object: true,
    user_id: row.owner_id,

    // ідентифікація
    id: row.id,
    category_key: row.category_key,
    category_id:  row.category_key, // зворотна сумісність

    // i18n як у сирому рядку
    name_ua: row.name_ua, name_en: row.name_en, name_es: row.name_es,
    category_ua: row.category_ua, category_en: row.category_en, category_es: row.category_es,
    description_ua: row.description_ua, description_en: row.description_en, description_es: row.description_es,

    // режимне поле
    [key]: { value: v, unit: rawUnit ? String(rawUnit) : null },

    // мета (лише корисне)
    curated: !!row.curated,
    is_official: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  return rec;
}

/* ─────────────────────── Нормалізація OFFICIAL → формат бібліотеки ───────────────────────
   Робимо те саме, що для UGC: гарантуємо {id, category_key, name_*, description_*, [key]:{value,unit}}.
*/

function normalizeOfficial(rec, mode) {
  if (!rec || !mode) return null;
  const key = MODE_FIELD[mode];
  if (!key) return null;

  // 1) Значення
  const rawV = rec?.[key]?.value ?? rec?.[key]; // офіційні можуть мати число напряму
  const rawU = rec?.[key]?.unit  ?? rec?.unit;
  const v = Number(rawV);
  if (!Number.isFinite(v) || v <= 0) return null;

  // 2) Категорія + id
  const category_key = ensureCategoryKey(rec);
  const id = norm(rec?.id) || makeStableIdForOfficial(mode, { ...rec, category_key });

  const out = {
    source: 'official',
    is_user_object: false,

    id,
    category_key,
    category_id: category_key, // зворотна сумісність

    // переносимо i18n як є (якщо якихось мов немає — залишаться undefined/null)
    name_ua: rec?.name_ua, name_en: rec?.name_en, name_es: rec?.name_es,
    category_ua: rec?.category_ua, category_en: rec?.category_en, category_es: rec?.category_es,
    description_ua: rec?.description_ua, description_en: rec?.description_en, description_es: rec?.description_es,

    [key]: { value: v, unit: rawU ? String(rawU) : null },

    is_official: true
  };

  return out;
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

function dedupeMerge(officialNorm, userNorm) {
  // Стратегія проста й стабільна:
  //  - індексуємо офіційні за id
  //  - поверх кладемо юзерські за id (оновлюють при збігу id)
  const byId = new Map();
  for (const r of officialNorm) {
    if (!r?.id) continue;
    byId.set(String(r.id), r);
  }
  for (const u of userNorm) {
    if (!u?.id) continue;
    byId.set(String(u.id), u); // юзерський має пріоритет за тим самим id
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

  // за id
  const next = cur.filter(item => String(item?.id) !== String(normalized.id));
  next.unshift(normalized); // свіжий нагору

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
 * Працює коректніше після нормалізації офіційних записів.
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
/** ───────────────────────────── Категорії для селектора ─────────────────────────────
 * Повертає масив категорій у форматі:
 *   { key, name_i18n: { ua, en, es }, isUser }
 * Працює для: 'distance' | 'diameter' | 'mass' | 'luminosity'.
 * Читає лише з кешу (ready(mode) → getUniversLibrary(mode)).
 * Групування строго за category_key; isUser === true, якщо для key немає жодного is_official===true.
 * Порядок — за першою появою key у кеші (стабільний), тай-брейк — по key.
 */
export async function listCategories(mode) {
  if (!mode) throw new Error('[univers_lib] listCategories(mode): mode is required');
  if (!Object.prototype.hasOwnProperty.call(MODE_FIELD, mode)) {
    throw new Error(`[univers_lib] listCategories: unsupported mode "${mode}"`);
  }

  await ready(mode);
  const list = Array.isArray(getUniversLibrary(mode)) ? getUniversLibrary(mode) : [];

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
        // стартуємо з "користувацька", скинемо до false якщо зустрінемо офіційний запис
        isUser: rec?.is_official ? false : true,
      };
      byKey.set(key, entry);
      order.push(key);
    } else {
      if (!entry.name_i18n.ua && rec?.category_ua) entry.name_i18n.ua = S(rec.category_ua);
      if (!entry.name_i18n.en && rec?.category_en) entry.name_i18n.en = S(rec.category_en);
      if (!entry.name_i18n.es && rec?.category_es) entry.name_i18n.es = S(rec.category_es);
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
