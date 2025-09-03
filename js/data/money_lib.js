// full/js/data/money_lib.js
'use strict';

/**
 * Еталонний лоадер бібліотеки для режиму «Гроші».
 * Завдання:
 *  - один мережевий запит на /data/money.json;
 *  - кешувати той самий Promise, щоб не було гонок;
 *  - не містити жодного UI / i18n / формул.
 *
 * Експорти:
 *  - loadMoneyLibrary(): Promise<void>
 *  - getMoneyLibrary(): any[]
 */

let __moneyLib = [];
let __moneyLibPromise = null;

export async function loadMoneyLibrary() {
  // Якщо завантаження вже стартувало — повертаємо той самий проміс
  if (__moneyLibPromise) return __moneyLibPromise;

  __moneyLibPromise = (async () => {
    const url = '/data/money.json';

    let res;
    try {
      res = await fetch(url, { cache: 'no-cache' });
    } catch (e) {
      console.error('[money_lib] network error', e);
      throw new Error('[money_lib] failed to fetch money.json');
    }

    if (!res.ok) {
      throw new Error(`[money_lib] HTTP ${res.status} for ${url}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('[money_lib] money.json must be an array of records');
    }

    __moneyLib = data;
  })();

  return __moneyLibPromise;
}

export function getMoneyLibrary() {
  return __moneyLib;
}
