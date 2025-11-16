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
    .select('id, created_at, updated_at, is_public, lang, title, description, mode, title_ua, title_en, title_es, description_ua, description_en, description_es')
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
    .select('id, created_at, is_public, lang, title, description, mode, title_ua, title_en, title_es, description_ua, description_en, description_es')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Створити сцену
 * @param {{title:string, description?:string, lang?:'ua'|'en'|'es', is_public?:boolean, mode:string, query:object}} payload
 * @returns {Promise<string>} id нової сцени
 */
export async function createScene(payload) {
  const sb = await getSupabase();
  const owner_id = await getUserIdRequired();
  const lang = payload.lang ?? 'ua';

  const row = {
    owner_id,
    title: payload.title,
    description: payload.description ?? null,
    lang,
    is_public: !!payload.is_public,
    mode: payload.mode,
    query: payload.query,
  };

  // Одразу заповнюємо локалізовані поля для базової мови
  if (lang === 'ua') {
    row.title_ua = payload.title;
    row.description_ua = payload.description ?? null;
  } else if (lang === 'en') {
    row.title_en = payload.title;
    row.description_en = payload.description ?? null;
  } else if (lang === 'es') {
    row.title_es = payload.title;
    row.description_es = payload.description ?? null;
  }

  const { data, error } = await sb.from('scenes').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Оновити сцену (повертає true або кидає помилку «Not found or access denied»)
 * @param {string} id
 * @param {{
 *   title?:string,
 *   description?:string,
 *   lang?:'ua'|'en'|'es',
 *   is_public?:boolean,
 *   mode?:string,
 *   query?:object,
 *   title_ua?:string,
 *   title_en?:string,
 *   title_es?:string,
 *   description_ua?:string,
 *   description_en?:string,
 *   description_es?:string
 * }} patch
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

// === Counters: authoritative fetch + broadcast ===
async function fetchSceneCounters(sceneId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('scenes_public_feed')
    .select('id, views, likes')
    .eq('id', sceneId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const id = data?.id ?? sceneId;
  return { id, views: data?.views ?? 0, likes: data?.likes ?? 0 };
}

function emitCountersUpdate(payload) {
  try {
    window.dispatchEvent(new CustomEvent('sceneCountersUpdated', { detail: payload }));
  } catch (_) { /* no-op for SSR/tests */ }
}

// === Public feeds: scene of the day / interesting / all public ===

// 1) Сцена дня — читаємо з view, де вже є views/likes
export async function getSceneOfDay() {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('scene_of_day_feed')
    .select('*')
    .order('pick_date', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return (data && data[0]) ? data[0] : null;
}

// 2) Цікаві сцени — теж з view (плоскі рядки з views/likes)
export async function listInteresting({ limit = 20 } = {}) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('scenes_interesting_feed')
    .select('*')
    .order('rank', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

// 3) All public scenes (newest first) with pagination
export async function listAllPublic({ limit = 30, offset = 0 } = {}) {
  const sb = await getSupabase();
  const start = offset;
  const end = offset + limit - 1;

  // Беремо дані з view: scenes_public_feed (вже відфільтровано is_public=TRUE)
  const { data, error } = await sb
    .from('scenes_public_feed')
    .select(`
      id, owner_id, created_at, updated_at,
      lang, title, description,
      title_ua, title_en, title_es,
      description_ua, description_en, description_es,
      mode, query,
      views, likes
    `)
    .order('created_at', { ascending: false })
    .range(start, end);

  if (error) throw new Error(error.message);
  return data || [];
}



export async function incrementSceneView(sceneId) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('inc_scene_view', { p_scene_id: sceneId });
  if (error) throw new Error(error.message);

  const counters = await fetchSceneCounters(sceneId);
  emitCountersUpdate(counters);
  return counters; // { id, views, likes }
}

export async function toggleLike(sceneId) {
  const sb = await getSupabase();
  const userId = await getUserIdRequired();

  // перевіряємо стан
  const exists = await sb
    .from('scene_likes')
    .select('scene_id', { count: 'exact', head: false })
    .eq('scene_id', sceneId)
    .eq('user_id', userId)
    .maybeSingle();

  if (exists.error && exists.error.code !== 'PGRST116') {
    throw new Error(exists.error.message);
  }

  if (exists.data) {
    const del = await sb.from('scene_likes').delete()
      .eq('scene_id', sceneId).eq('user_id', userId);
    if (del.error) throw new Error(del.error.message);
  } else {
    const ins = await sb.from('scene_likes').insert({ scene_id: sceneId, user_id: userId });
    if (ins.error) throw new Error(ins.error.message);
  }

  // читаємо фактичні лічильники з БД
  const counters = await fetchSceneCounters(sceneId);
  const liked = !exists.data;

  emitCountersUpdate(counters);
  return { liked, likes: counters.likes, views: counters.views };
}

// === Моє: набір scene_id, які лайкнув поточний користувач серед переданих ===
export async function getMyLikedSceneIds(sceneIds = []) {
  try {
    if (!Array.isArray(sceneIds) || sceneIds.length === 0) return new Set();

    const sb = await getSupabase();
    const uid = await getUserIdOrNull();
    if (!uid) return new Set(); // гість — нічого не підсвічуємо

    const { data, error } = await sb
      .from('scene_likes')      // таблиця лайків
      .select('scene_id')
      .eq('user_id', uid)
      .in('scene_id', sceneIds);

    if (error) throw new Error(error.message);
    return new Set((data || []).map(r => r.scene_id));
  } catch (e) {
    console.error('[cloud] getMyLikedSceneIds failed:', e);
    return new Set();
  }
}
