// full/js/data/universe.js
'use strict';

let __universeCache = [];
let __loadPromise = null;

/**
 * Повертає бібліотеку з пам’яті (може бути порожня до першого завантаження)
 */
export function getUniverseLibrary() {
  return Array.isArray(__universeCache) ? __universeCache : [];
}

/**
 * Завантажує univers.json один раз.
 * Повторні виклики повертають кеш або той самий проміс, без додаткових запитів.
 */
export async function loadUniverseLibrary() {
  if (__loadPromise) return __loadPromise;
  if (Array.isArray(__universeCache) && __universeCache.length) return __universeCache;

  __loadPromise = fetch('/full/data/univers.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      __universeCache = Array.isArray(data) ? data : [];
      return __universeCache;
    })
    .catch((err) => {
      console.error('❌ Не вдалося завантажити univers.json', err);
      __universeCache = [];
      return __universeCache;
    })
    .finally(() => {
      __loadPromise = null;
    });

  return __loadPromise;
}
