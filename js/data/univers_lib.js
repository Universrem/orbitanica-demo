// full/js/data/univers_lib.js
'use strict';

/**
 * Лоадер бібліотеки «Всесвіт» для всіх режимів.
 * Один мережевий запит + кеш проміса. Без UI/i18n.
 *
 * Експорти:
 *  - loadUniversLibrary(): Promise<void>
 *  - getUniversLibrary(): any[]
 */

let __universLib = [];
let __universLibPromise = null;

export async function loadUniversLibrary() {
  if (__universLibPromise) return __universLibPromise;

  __universLibPromise = (async () => {
    const url = '/data/univers.json';

    let res;
    try {
      res = await fetch(url, { cache: 'no-cache' });
    } catch (e) {
      console.error('[univers_lib] network error', e);
      throw new Error('[univers_lib] failed to fetch univers.json');
    }

    if (!res.ok) {
      throw new Error(`[univers_lib] HTTP ${res.status} for ${url}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('[univers_lib] univers.json must be an array of records');
    }

    __universLib = data;
  })();

  return __universLibPromise;
}

export function getUniversLibrary() {
  return __universLib;
}
