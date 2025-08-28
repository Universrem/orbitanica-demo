'use strict';

/**
 * Еталонний лоадер бібліотеки для режиму «Математика».
 * Завдання:
 *  - один мережевий запит на /full/data/mathematics.json;
 *  - кешувати той самий Promise, щоб не було гонок;
 *  - не містити жодного UI / i18n / формул.
 *
 * Експорти:
 *  - loadMathLibrary(): Promise<void>
 *  - getMathLibrary(): any[]
 */

let __mathLib = [];
let __mathLibPromise = null;

export async function loadMathLibrary() {
  // Якщо завантаження вже стартувало — повертаємо той самий проміс
  if (__mathLibPromise) return __mathLibPromise;

  __mathLibPromise = (async () => {
    const url = '/full/data/mathematics.json';

    let res;
    try {
      res = await fetch(url, { cache: 'no-cache' });
    } catch (e) {
      console.error('[math_lib] network error', e);
      throw new Error('[math_lib] failed to fetch mathematics.json');
    }

    if (!res.ok) {
      throw new Error(`[math_lib] HTTP ${res.status} for ${url}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('[math_lib] mathematics.json must be an array of records');
    }

    __mathLib = data;
  })();

  return __mathLibPromise;
}

export function getMathLibrary() {
  return __mathLib;
}
