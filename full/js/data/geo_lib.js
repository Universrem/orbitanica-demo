// full/js/data/geo_lib.js
'use strict';

/**
 * Лоадер бібліотеки для режиму «Географія».
 * Завдання:
 *  - один мережевий запит на /full/data/geography.json;
 *  - кешувати той самий Promise, щоб не було гонок;
 *  - не містити жодного UI / i18n / формул.
 *
 * Експорти:
 *  - loadGeoLibrary(): Promise<void>
 *  - getGeoLibrary(): any[]
 */

let __geoLib = [];
let __geoLibPromise = null;

export async function loadGeoLibrary() {
  // Якщо завантаження вже стартувало — повертаємо той самий проміс
  if (__geoLibPromise) return __geoLibPromise;

  __geoLibPromise = (async () => {
    const url = '/full/data/geography.json';

    let res;
    try {
      res = await fetch(url, { cache: 'no-cache' });
    } catch (e) {
      console.error('[geo_lib] network error', e);
      throw new Error('[geo_lib] failed to fetch geography.json');
    }

    if (!res.ok) {
      throw new Error(`[geo_lib] HTTP ${res.status} for ${url}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('[geo_lib] geography.json must be an array of records');
    }

    __geoLib = data;
  })();

  return __geoLibPromise;
}

export function getGeoLibrary() {
  return __geoLib;
}
