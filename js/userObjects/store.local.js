'use strict';

const KEY = 'orbit.userObjects.v1';

let cache = load();
const subscribers = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
  } catch (e) { console.warn('[store.local] load error', e); }
  return [];
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(cache));
  notify();
}

function notify() {
  const snapshot = cache.slice();
  subscribers.forEach(cb => { try { cb(snapshot); } catch {} });
  document.dispatchEvent(new CustomEvent('user-objects-changed', { detail: { all: snapshot } }));
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf);
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function list(mode) {
  return cache.filter(o => o && o.mode === mode);
}

export function getByName(mode, name, category) {
  const norm = s => (s || '').trim().toLowerCase();
  const nName = norm(name);
  const nCat  = norm(category);
  return cache.find(o =>
    o &&
    o.mode === mode &&
    norm(o.name || o.name_i18n?.[o.originalLang]) === nName &&
    norm(o.category || o.category_i18n?.[o.originalLang]) === nCat
  ) || null;
}


export function add(obj) {
  const now = new Date().toISOString();
  const norm = s => (s || '').trim().toLowerCase();

  const keyMode = obj.mode;
  const keyName = norm(obj.name || obj.name_i18n?.[obj.originalLang]);
  const keyCat  = norm(obj.category || obj.category_i18n?.[obj.originalLang]);

  let idx = cache.findIndex(o =>
    o &&
    o.mode === keyMode &&
    norm(o.name || o.name_i18n?.[o.originalLang]) === keyName &&
    norm(o.category || o.category_i18n?.[o.originalLang]) === keyCat
  );

  const rec = { id: idx >= 0 ? cache[idx].id : uuid(), status: 'draft', source: 'user', createdAt: now, ...obj };

  if (idx >= 0) cache[idx] = rec; else cache.push(rec);
  persist();
  return rec;
}


export function remove(id) {
  cache = cache.filter(o => o.id !== id);
  persist();
}

export function onChange(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function exportAll() {
  return JSON.stringify(cache, null, 2);
}

export function importAll(jsonString) {
  try {
    const arr = JSON.parse(jsonString);
    if (Array.isArray(arr)) {
      cache = mergeUnique(cache, arr);
      persist();
    }
  } catch (e) {
    console.error('[store.local] import error', e);
  }
}

function mergeUnique(a, b) {
  const map = new Map();
  [...a, ...b].forEach(o => {
    const key = `${o.mode}|${o.name}|${o.category}|${o.attrs?.unit}|${o.attrs?.value}`;
    map.set(key, o);
  });
  return Array.from(map.values());
}
