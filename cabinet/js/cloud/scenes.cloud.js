// /cabinet/js/cloud/scenes.cloud.js
import { getSupabase } from '/cabinet/js/cloud/config.js';

async function me() {
  const sb = await getSupabase();
  const { data: { user }, error } = await sb.auth.getUser();
  if (error) throw new Error(error.message);
  return user || null;
}

export async function listMine() {
  const sb = await getSupabase();
  const user = await me();
  if (!user) return [];
  const { data, error } = await sb
    .from('scenes')
    .select('id, status, mode, title_ua, title_en, title_es, created_at, published_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getOne(id) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('scenes').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createFromPayload({ title, mode, o1, o2n }) {
  const sb = await getSupabase();
  const user = await me();
  if (!user) throw new Error('Not authenticated');

  const rec = {
    owner_id: user.id,
    status: 'private',
    mode: mode ?? null,
    o1: o1 ?? null,
    o2n: Array.isArray(o2n) ? o2n : [],
    title_en: title || '',
    title_ua: title || '',
    title_es: title || '',
    description_en: '',
    description_ua: '',
    description_es: ''
  };

  const { data, error } = await sb.from('scenes').insert(rec).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function setStatus(id, status) {
  const sb = await getSupabase();
  const { error } = await sb.from('scenes').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function remove(id) {
  const sb = await getSupabase();
  const { error } = await sb.from('scenes').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

// коротке посилання (створюємо, якщо нема)
export async function ensureShortLink(sceneId) {
  const sb = await getSupabase();
  // є?
  let { data, error } = await sb.from('shortlinks').select('code').eq('scene_id', sceneId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.code) return data.code;

  // створити
  const code = Math.random().toString(36).slice(2, 8).toLowerCase();
  const ins = await sb.from('shortlinks').insert({ code, scene_id: sceneId }).select('code').single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data.code;
}
