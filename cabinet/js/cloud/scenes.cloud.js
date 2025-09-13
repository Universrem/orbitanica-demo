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
// === Public feeds: scene of the day / interesting / all public ===

// 1) One active scene of the day (or null)
export async function getSceneOfDay() {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('scene_picks')
    .select(`
      created_at,
      scene:scene_id (
        id, owner_id, is_public, created_at, updated_at,
        title, description, mode, query
      )
    `)
    .eq('type', 'day')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return (data && data[0]) ? data[0].scene : null;
}


// 2) Curated "interesting" list (rank ASC NULLS LAST, then created_at DESC)
export async function listInteresting({ limit = 20 } = {}) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('scene_picks')
    .select(`
      rank,
      created_at,
      scene:scene_id (
        id, owner_id, is_public, created_at, updated_at,
        title, description, mode, query
      )
    `)
    .eq('type', 'interesting')
    .eq('is_active', true)
    .order('rank', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || [])
    .map(row => {
      const scene = row.scene || null;
      if (scene) scene._pick_rank = row.rank;
      return scene;
    })
    .filter(Boolean);
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
      lang, title, description, mode, query,
      views, likes
    `)
    .order('created_at', { ascending: false })
    .range(start, end);

  if (error) throw new Error(error.message);
  return data || [];
}
/** Збільшити лічильник переглядів сцени (RPC) */
export async function incrementSceneView(sceneId) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('inc_scene_view', { p_scene_id: sceneId });
  if (error) throw new Error(error.message);
  return true;
}
/**
 * Поставити/зняти лайк для поточного користувача.
 * Повертає { liked:boolean, likes:number } — актуальний стан та кількість.
 */
export async function toggleLike(sceneId) {
  const sb = await getSupabase();
  const userId = await getUserIdRequired();

  // Чи вже лайкнуто?
  const exists = await sb
    .from('scene_likes')
    .select('scene_id', { count: 'exact', head: false })
    .eq('scene_id', sceneId)
    .eq('user_id', userId)
    .maybeSingle();

  if (exists.error && exists.error.code !== 'PGRST116') {
    // PGRST116 — no rows; інші помилки — пробросити
    throw new Error(exists.error.message);
  }

  if (exists.data) {
    // Вже було — знімаємо лайк
    const del = await sb
      .from('scene_likes')
      .delete()
      .eq('scene_id', sceneId)
      .eq('user_id', userId);
    if (del.error) throw new Error(del.error.message);
  } else {
    // Не було — ставимо лайк
    const ins = await sb
      .from('scene_likes')
      .insert({ scene_id: sceneId, user_id: userId });
    if (ins.error) throw new Error(ins.error.message);
  }

  // Повернути актуальну кількість
  const cnt = await sb
    .from('scene_likes')
    .select('*', { count: 'exact', head: true })
    .eq('scene_id', sceneId);

  if (cnt.error) throw new Error(cnt.error.message);
  const likes = typeof cnt.count === 'number' ? cnt.count : 0;
  const liked = !exists.data; // якщо вставили — тепер liked=true; якщо видалили — false

  return { liked, likes };
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

