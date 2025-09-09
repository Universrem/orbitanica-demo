// /cabinet/js/cloud/scenes.cloud.js
// CRUD для scenes/shortlinks під RLS

import { getSupabase } from '/cabinet/js/cloud/config.js';

/** Повертає userId або null (401 ≠ помилка) */
async function getUserIdOrNull() {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error) {
    if (error.status === 401) return null; // не увійшов
    if (String(error.message || '').toLowerCase().includes('not authenticated')) return null;
    throw new Error(error.message);
  }
  return data?.user?.id ?? null;
}
async function getUserIdRequired() {
  const uid = await getUserIdOrNull();
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

/**
 * Список моїх сцен (з пагінацією)
 * @param {{limit?:number, offset?:number}} opts
 */
export async function listMine({ limit = 50, offset = 0 } = {}) {
  const sb = await getSupabase();
  const uid = await getUserIdRequired();
  const from = offset;
  const to = offset + limit - 1;
  const { data, error } = await sb
    .from('scenes')
    .select('id, created_at, updated_at, is_public, lang, title, description, mode')
    .eq('owner_id', uid)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return data || [];
}

/** Отримати сцену за id (RLS: публічна або своя) */
export async function getSceneById(id) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('scenes').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

/** Отримати сцену за коротким кодом (JOIN) */
export async function getSceneByCode(code) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('shortlinks')
    .select('scenes(*)')
    .eq('code', code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.scenes ?? null; // якщо FK названо інакше — підправимо назву рілейшена
}

/**
 * Публічні сцени (ліва панель «All public»)
 * @param {{limit?:number, offset?:number}} opts
 */
export async function listPublic({ limit = 20, offset = 0 } = {}) {
  const sb = await getSupabase();
  const from = offset;
  const to = offset + limit - 1;
  const { data, error } = await sb
    .from('scenes')
    .select('id, created_at, is_public, lang, title, description, mode')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Створити сцену
 * @param {{title:string, description?:string, lang?:'uk'|'en'|'es', is_public?:boolean, mode:string, query:object}} payload
 * @returns {Promise<string>} id нової сцени
 */
export async function createScene(payload) {
  const sb = await getSupabase();
  const owner_id = await getUserIdRequired();
  const row = {
    owner_id,
    title: payload.title,
    description: payload.description ?? null,
    lang: payload.lang ?? 'uk',
    is_public: !!payload.is_public,
    mode: payload.mode,
    query: payload.query,
  };
  const { data, error } = await sb.from('scenes').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Оновити сцену (повертає true або кидає помилку «Not found or access denied»)
 * @param {string} id
 * @param {{title?:string, description?:string, lang?:'uk'|'en'|'es', is_public?:boolean, mode?:string, query?:object}} patch
 */
export async function updateScene(id, patch) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('scenes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .maybeSingle(); // RLS: якщо не власник або немає — повернеться null
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Not found or access denied');
  return true;
}

/** Видалити сцену (RLS: тільки власник; shortlinks видаляться каскадом) */
export async function deleteScene(id) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('scenes').delete().eq('id', id).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Not found or access denied');
  return true;
}

/**
 * Повертає існуючий код або генерує новий унікальний.
 * Колізії ловимо на INSERT (UNIQUE в БД) і пробуємо заново.
 */
export async function ensureShortLink(sceneId) {
  const sb = await getSupabase();

  // якщо вже є код — повертаємо
  const existing = await sb.from('shortlinks').select('code').eq('scene_id', sceneId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.code) return existing.data.code;

  // намагаємось кілька разів вставити унікальний код
  for (let i = 0; i < 6; i++) {
    const code = Math.random().toString(36).slice(2, 8).toLowerCase();
    const ins = await sb.from('shortlinks').insert({ code, scene_id: sceneId }).select('code').single();
    if (!ins.error) return ins.data.code;
    // 23505 = unique_violation у Postgres
    if (ins.error?.code !== '23505') throw new Error(ins.error.message);
    // колізія — пробуємо ще раз з іншим кодом
  }
  throw new Error('Failed to generate unique short code');
}
