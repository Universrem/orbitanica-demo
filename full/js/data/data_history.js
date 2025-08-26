// full/js/data/data_history.js
'use strict';

import { getCurrentLang } from '../i18n.js';
import { getStore } from '../userObjects/api.js';

// ─────────────────────────────────────────────────────────────
// ЛОКАЛЬНА БІБЛІОТЕКА ПОДІЙ (history.json) — тільки для режиму "Історія"

let __historyCache = [];
let __loadPromise = null;

export function getHistoryLibrary() {
  return Array.isArray(__historyCache) ? __historyCache : [];
}

export function loadHistoryLibrary() {
  if (__loadPromise) return __loadPromise;
  if (Array.isArray(__historyCache) && __historyCache.length) return Promise.resolve(__historyCache);

  const url = new URL('../../data/history.json', import.meta.url);

  __loadPromise = fetch(url)
    .then(r => r.json())
    .then(arr => {
      __historyCache = Array.isArray(arr) ? arr : [];
      return __historyCache;
    })
    .catch(e => {
      console.error('[data_history] load error', e);
      __historyCache = [];
      return __historyCache;
    })
    .finally(() => { __loadPromise = null; });

  return __loadPromise;
}

// ─────────────────────────────────────────────────────────────
// Хелпери

const NOW_YEAR = 2025; // центр усіх кіл — сьогодні

function readYear(obj, key) {
  // очікуємо { value: number, unit: "year" } або number
  const v = obj?.[key];
  if (typeof v === 'number') return v;
  if (v && typeof v.value === 'number') return v.value;
  return null;
}

function yearsDistanceFromNow(year) {
  if (!Number.isFinite(year)) return null;
  // враховано роки з мінусом (до н.е.) і з плюсом (н.е.)
  return Math.abs(NOW_YEAR - year);
}

function userDesc(o, lang) {
  return o?.description_i18n?.[lang] || o?.description || '';
}

// ─────────────────────────────────────────────────────────────
// Основний зчитувач стану форми

export function getHistoryData() {
  const lang = getCurrentLang();

  const cat1 = document.getElementById('histCategoryObject1')?.value || '';
  const obj1 = document.getElementById('histObject1')?.value || '';
  const input1 = Number(document.getElementById('histCircleObject1')?.value || 0); // ДІАМЕТР кола О1 (у м)

  const cat2 = document.getElementById('histCategoryObject2')?.value || '';
  const obj2 = document.getElementById('histObject2')?.value || '';

  const lib = getHistoryLibrary() || [];
  const store = getStore?.();

  // ── О1: ТІЛЬКИ офіційна бібліотека (як у відстані/діаметрі)
  const idx1 = lib.findIndex(o => o?.[`name_${lang}`] === obj1 && o?.[`category_${lang}`] === cat1);
  const o1 = idx1 >= 0 ? lib[idx1] : null;

  if (!o1) return null; // без О1 масштаб не побудуємо

  const y1s = readYear(o1, 'time_start');
  const y1e = readYear(o1, 'time_end');
  const years1s = yearsDistanceFromNow(y1s);
  const years1e = yearsDistanceFromNow(y1e);

  // ігноруємо майбутнє (роки > NOW_YEAR) та невалідне
  const valid1s = Number.isFinite(y1s) && y1s <= NOW_YEAR ? years1s : null;
  const valid1e = Number.isFinite(y1e) && y1e <= NOW_YEAR ? years1e : null;

  // ── О2: спершу шукаємо у користувацьких (mode='history'), потім у бібліотеці
  let idx2 = -1, o2 = null, o2_user = null;
  try {
    const list = store?.list?.('history') || [];
    o2_user = list.find(o =>
      (o.category === cat2 || o.category_i18n?.[lang] === cat2) &&
      (o.name === obj2 || o.name_i18n?.[lang] === obj2)
    ) || null;
  } catch {}

  if (o2_user) {
    o2 = { user: true, ...o2_user };
  } else {
    idx2 = lib.findIndex(o => o?.[`name_${lang}`] === obj2 && o?.[`category_${lang}`] === cat2);
    o2 = idx2 >= 0 ? lib[idx2] : null;
  }

  let o2pack = null;
  if (o2) {
    const y2s = o2.user ? o2.attrs?.time_start : readYear(o2, 'time_start');
    const y2e = o2.user ? o2.attrs?.time_end   : readYear(o2, 'time_end');

    const years2s = yearsDistanceFromNow(y2s);
    const years2e = yearsDistanceFromNow(y2e);

    const valid2s = Number.isFinite(y2s) && y2s <= NOW_YEAR ? years2s : null;
    const valid2e = Number.isFinite(y2e) && y2e <= NOW_YEAR ? years2e : null;

    o2pack = {
      libIndex: o2.user ? -1 : idx2,
      name:     o2.user ? (o2.name || o2.name_i18n?.[lang] || '') : (o2[`name_${lang}`] || ''),
      category: o2.user ? (o2.category || o2.category_i18n?.[lang] || '') : (o2[`category_${lang}`] || ''),
      // оригінальні роки (для показу зліва)
      yearStart: o2.user ? y2s : readYear(o2, 'time_start'),
      yearEnd:   o2.user ? y2e : readYear(o2, 'time_end'),
      // часові відстані (для радіусу)
      yearsStart: valid2s,
      yearsEnd:   valid2e,
      description: o2.user ? userDesc(o2, lang) : (o2[`description_${lang}`] || '')
    };
  }

  return {
    object1: {
      libIndex: idx1,
      name: o1[`name_${lang}`] || '',
      category: o1[`category_${lang}`] || '',
      yearStart: readYear(o1, 'time_start'),
      yearEnd:   readYear(o1, 'time_end'),
      yearsStart: valid1s,
      yearsEnd:   valid1e,
      diameterScaled: input1, // ДІАМЕТР кола на мапі (в м), який задає масштаб
      description: o1[`description_${lang}`] || ''
    },
    object2: o2pack
  };
}
