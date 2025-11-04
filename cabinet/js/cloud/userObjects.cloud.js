// /cabinet/js/cloud/userObjects.cloud.js
// Хмарний CRUD для користувацьких об’єктів (тільки Supabase, без локального зберігання).
// Експорти: listPublic, listMine, upsert, remove

'use strict';

import { getSupabase } from './config.js';

/* ───────────────────────────── Утіліти ───────────────────────────── */

function normStr(v) { return v == null ? null : String(v); }
function isPosNum(v) { const n = Number(v); return Number.isFinite(n) && n > 0; }

/** Вирівнюємо одиниці виміру: гарантуємо наявність unit_key (поряд із unit для сумісності) */
function normalizeUnits(item) {
  if (!item || typeof item !== 'object') return item;
  // основна величина
  if (item.unit_key == null && item.unit != null) item.unit_key = item.unit;
  if (item.unit == null && item.unit_key != null) item.unit = item.unit_key;
  // друга (для режимів, де є value2)
  if (item.unit2_key == null && item.unit2 != null) item.unit2_key = item.unit2;
  if (item.unit2 == null && item.unit2_key != null) item.unit2 = item.unit2_key;
  return item;
}

/** Перетворення UGC-об'єкта у «стандартний» під внутрішню бібліотеку */
function standardizeUserObject(item) {
  if (!item || typeof item !== 'object') return item;

  // завжди унормовуємо одиниці
  normalizeUnits(item);

  // уніфікуємо i18n-поля як рядки (без обрізання — обрізка в UI)
  item.name_ua = normStr(item.name_ua);
  item.name_en = normStr(item.name_en);
  item.name_es = normStr(item.name_es);

  item.category_key = normStr(item.category_key);
  item.category_ua  = normStr(item.category_ua);
  item.category_en  = normStr(item.category_en);
  item.category_es  = normStr(item.category_es);

  item.description_ua = normStr(item.description_ua);
  item.description_en = normStr(item.description_en);
  item.description_es = normStr(item.description_es);

  // Прокладаємо "офіційні" прапорці (для бейджів/відборів)
  item.is_user_object = true;
  item.is_official = !!item.is_official; // за замовчуванням false
  item.source = 'user';

  // Значення «за замовчуванням» для зручності блоків
  const v  = item.value;
  const u  = item.unit_key || item.unit;
  const v2 = item.value2;
  const u2 = item.unit2_key || item.unit2;

  // Режимні поля (ОДИН єдиний ключ { value, unit } на режим)
  switch (item.mode) {
    // ——— Univers ———
    case 'distance': {
      if (isPosNum(v) && u) item.distance_to_earth = { value: Number(v), unit: String(u) };
      else delete item.distance_to_earth;
      break;
    }
    case 'diameter': {
      if (isPosNum(v) && u) item.diameter = { value: Number(v), unit: String(u) };
      else delete item.diameter;
      break;
    }
    case 'mass': {
      if (isPosNum(v) && u) item.mass = { value: Number(v), unit: String(u) };
      else delete item.mass;
      break;
    }
    case 'luminosity': {
      if (isPosNum(v) && u) item.luminosity = { value: Number(v), unit: String(u) };
      else delete item.luminosity;
      break;
    }
    case 'geo_objects': {
      if (isPosNum(v) && u) item.length = { value: Number(v), unit: String(u) };
      else delete item.length;
      break;
    }
    case 'geo_area': {
      if (isPosNum(v) && u) item.area = { value: Number(v), unit: String(u) };
      else delete item.area;
      break;
    }
    case 'geo_population': {
      if (isPosNum(v) && u) item.population = { value: Number(v), unit: String(u) };
      else delete item.population;
      break;
    }
    case 'money': {
      if (isPosNum(v) && u) item.amount = { value: Number(v), unit: String(u) };
      else delete item.amount;
      break;
    }
    case 'math': {
      if (isPosNum(v) && u) item.quantity = { value: Number(v), unit: String(u) };
      else delete item.quantity;
      break;
    }

    default:
      // інші/невідомі режими не чіпаємо
      break;
  }

  return item;
}



/** Keyset-курсори для пагінації */
function mkCursorArg(cursor) {
  if (!cursor || typeof cursor !== 'object') return { before_created: null, before_id: null };
  return {
    before_created: cursor.before_created ?? null,
    before_id: cursor.before_id ?? null
  };
}

/** Нормалізація вхідного об’єкта під RPC upsert_user_object */
function mapToUpsertArgs(obj = {}) {
  return {
    p_id: obj.id ?? null,
    p_mode: obj.mode ?? null,

    p_name_ua: obj.name_ua ?? null,
    p_name_en: obj.name_en ?? null,
    p_name_es: obj.name_es ?? null,

    p_description_ua: obj.description_ua ?? null,
    p_description_en: obj.description_en ?? null,
    p_description_es: obj.description_es ?? null,

    p_category_key: obj.category_key ?? null,
    p_category_ua: obj.category_ua ?? null,
    p_category_en: obj.category_en ?? null,
    p_category_es: obj.category_es ?? null,

    p_value:  obj.value  ?? null,
    p_value2: obj.value2 ?? null,
    p_unit_key:  obj.unit_key  ?? obj.unit ?? null,
    p_unit2_key: obj.unit2_key ?? obj.unit2 ?? null,

    p_is_public: obj.is_public ?? false,
    p_status: obj.status ?? 'published',
    p_tags: obj.tags ?? null,
    p_source_url: obj.source_url ?? null
  };
}

/* ───────────────────────────── Публічні API ───────────────────────────── */

/**
 * Публічні об’єкти для режиму.
 * @param {string} mode
 * @param {number} limit
 * @param {{before_created?: string, before_id?: string}} cursor
 * @returns {{items: any[], nextCursor: {before_created:string, before_id:string}|null}}
 */
export async function listPublic(mode, limit = 50, cursor = null) {
  const supabase = await getSupabase();
  const c = mkCursorArg(cursor);

  const { data, error } = await supabase.rpc('list_public_objects', {
    p_mode: mode,
    p_limit: limit,
    p_before_created: c.before_created,
    p_before_id: c.before_id
  });

  if (error) throw new Error(`listPublic failed: ${error.message}`);

  let items = Array.isArray(data) ? data : [];
  items = items.map(standardizeUserObject);

  const last = items[items.length - 1];
  const nextCursor = last ? { before_created: last.created_at, before_id: last.id } : null;

  return { items, nextCursor };
}

/**
 * Мої об’єкти для режиму (потрібна авторизація).
 */
export async function listMine(mode, limit = 50, cursor = null) {
  const supabase = await getSupabase();
  const c = mkCursorArg(cursor);

  const { data, error } = await supabase.rpc('list_my_objects', {
    p_mode: mode,
    p_limit: limit,
    p_before_created: c.before_created,
    p_before_id: c.before_id
  });

  if (error) throw new Error(`listMine failed: ${error.message}`);

  let items = Array.isArray(data) ? data : [];
  items = items.map(standardizeUserObject);

  const last = items[items.length - 1];
  const nextCursor = last ? { before_created: last.created_at, before_id: last.id } : null;

  return { items, nextCursor };
}

/**
 * Створити/оновити об’єкт (повертає ПОВНИЙ сирий рядок із БД, вже стандартизований).
 * obj: {
 *   id?, mode, name_ua?, name_en?, name_es?, description_ua?, description_en?, description_es?,
 *   category_key?, category_ua?, category_en?, category_es?,
 *   value?, value2?, unit_key?, unit2_key?,
 *   is_public?, status?, tags?, source_url?
 * }
 */
export async function upsert(obj) {
  const supabase = await getSupabase();
  const args = mapToUpsertArgs(obj);

  // Мінімальна валідація
  if (!args.p_mode) throw new Error('upsert: missing mode');
  if (args.p_value  != null && Number.isNaN(Number(args.p_value)))  throw new Error('upsert: value is NaN');
  if (args.p_value2 != null && Number.isNaN(Number(args.p_value2))) throw new Error('upsert: value2 is NaN');

  // 1) Викликаємо RPC
  const { data, error } = await supabase.rpc('upsert_user_object', args);
  if (error) throw new Error(`upsert failed: ${error.message}`);

  // 2) Визначаємо id щойно збереженого об’єкта
  const id = (data && typeof data === 'object' && data.id) ? data.id : (obj?.id ?? null);

  // 3) Якщо маємо id — дочитуємо ПОВНИЙ рядок із БД і повертаємо його
  if (id) {
    const { data: fresh, error: selErr } = await supabase
      .from('user_objects')
      .select('*')
      .eq('id', id)
      .single();

    if (selErr) {
      console.warn('[userObjects.cloud] select after upsert failed:', selErr.message);
      // Фолбек: повертаємо те, що є (може бути не повне), але стандартизуємо
      return standardizeUserObject(normalizeUnits(data || obj || {}));
    }

    return standardizeUserObject(normalizeUnits(fresh));
  }

  // Якщо RPC не повернув id і ми не можемо дочитати — повертаємо як є, але стандартизовано
  return standardizeUserObject(normalizeUnits(data || obj || {}));
}

/**
 * Видалити мій об’єкт за id.
 */
export async function remove(id) {
  if (!id) throw new Error('remove: missing id');
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('delete_user_object', { p_id: id });
  if (error) throw new Error(`remove failed: ${error.message}`);
  return true;
}

/** Утіліти для бейджів у списках */
export function getBadge(item, myUserId) {
  if (!item) return { type: 'community', label: 'Community' };
  if (item.is_official) return { type: 'official', label: 'Official' };
  if (item.curated) return { type: 'curated', label: 'Curated' };
  if (myUserId && item.owner_id === myUserId) return { type: 'mine', label: 'Mine' };
  return { type: 'community', label: 'Community' };
}
