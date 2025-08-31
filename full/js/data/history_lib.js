// full/js/data/history_lib.js
'use strict';

/**
 * Еталонний лоадер бібліотеки для режиму «Історія».
 * Завдання:
 *  - один мережевий запит на /full/data/history.json;
 *  - кешувати той самий Promise, щоб не було гонок;
 *  - не містити жодного UI / i18n / формул.
 *
 * Експорти:
 *  - loadHistoryLibrary(): Promise<void>
 *  - getHistoryLibrary(): any[]
 */

let __historyLib = [];
let __historyLibPromise = null;

export async function loadHistoryLibrary() {
  // Якщо завантаження вже стартувало — повертаємо той самий проміс
  if (__historyLibPromise) return __historyLibPromise;

  __historyLibPromise = (async () => {
    const url = '/full/data/history.json';

    let res;
    try {
      res = await fetch(url, { cache: 'no-cache' });
    } catch (e) {
      console.error('[history_lib] network error', e);
      throw new Error('[history_lib] failed to fetch history.json');
    }

    if (!res.ok) {
      throw new Error(`[history_lib] HTTP ${res.status} for ${url}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('[history_lib] history.json must be an array of records');
    }

    __historyLib = data;
  })();

  return __historyLibPromise;
}

export function getHistoryLibrary() {
  return __historyLib;
}
