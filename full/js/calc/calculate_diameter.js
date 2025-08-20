//full/js/calc/calculate_diameter.js

'use strict';

import { convertUnit } from '../utils/unit_converter.js';
import { addGeodesicCircle } from '../globe/circles.js';
import { getCurrentLang } from '../i18n.js';
import { getUniverseLibrary } from '../data/universe.js';

// Поточний масштаб (зберігається між викликами)
let currentScale = null;
let __baselineId = null;
let __baselineRealDiameterMeters = null;

// Скидання внутрішнього масштабу на глобальний reset UI
window.addEventListener('orbit:ui-reset', () => {
  currentScale = null;
  __baselineId = null;
  __baselineRealDiameterMeters = null;
});

export function getCurrentScale() {
  return currentScale;
}

// Публічне скидання масштабу
export function resetDiameterScale() {
  currentScale = null;
  __baselineRealDiameterMeters = null;
}

/**
 * Розраховує масштаб і (опційно) малює коло для Об’єкта 1
 * @param {number} realDiameterVal      Реальний діаметр Об’єкта 1
 * @param {string} realDiameterUnit     Одиниця (напр., "km")
 * @param {number} circleDiameterMeters Діаметр кола на землі (м)
 * @param {string} [color='rgba(255,0,0,0.8)']  Колір кола
 */
export function setObject1Scale(realDiameterVal, realDiameterUnit, circleDiameterMeters, color = 'rgba(255,0,0,0.8)') {
  const realDiameterMeters = Number(convertUnit(realDiameterVal, realDiameterUnit, 'm', 'diameter'));
  const circleDM = Number(circleDiameterMeters);

  __baselineId = null;

  if (!isFinite(realDiameterMeters) || realDiameterMeters <= 0 || !isFinite(circleDM) || circleDM <= 0) {
    currentScale = null;
    __baselineRealDiameterMeters = null;
    return null;
  }

  // Масштаб фіксуємо завжди
  currentScale = circleDM / realDiameterMeters;
  __baselineRealDiameterMeters = realDiameterMeters;

  // Якщо базове коло «вилазить» — масштаб лишаємо, але коло не малюємо
  const R_EARTH = 6_371_000;
  const LIM_RADIUS = Math.PI * R_EARTH;
  const EPS_M = 1;
  const r = circleDM / 2;
  if (r > LIM_RADIUS + EPS_M) {
    return null;
  }

  // Малюємо базове коло (в межах)
  try {
    __baselineId = addGeodesicCircle(r, color, __baselineId);
  } catch {
    __baselineId = null;
  }
  return __baselineId;
}

/**
 * Малює коло для Об’єкта 2 з використанням масштабу Об’єкта 1
 * @param {number} realDiameterVal  Реальний діаметр Об’єкта 2
 * @param {string} realDiameterUnit Одиниця (напр., "km")
 * @param {string} color            Колір кола
 */
export function addObject2Circle(realDiameterVal, realDiameterUnit, color) {
    if (currentScale == null || !(currentScale > 0)) {
    return { id: null, scaledDiameterMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }

  const realDiameterMeters = Number(convertUnit(realDiameterVal, realDiameterUnit, 'm', 'diameter'));
  if (!isFinite(realDiameterMeters) || realDiameterMeters <= 0) {
    return { id: null, scaledDiameterMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }

  const scaledDiameterMeters = realDiameterMeters * currentScale;

  // Перевірка порогу (антипод)
  const R_EARTH = 6_371_000;
  const LIM_RADIUS = Math.PI * R_EARTH;
  const EPS_M = 1;

  if ((scaledDiameterMeters / 2) > (LIM_RADIUS + EPS_M)) {
    // Потрібний діаметр базового кола на карті, щоб О2 став рівно антиподом:
    // Dmap1_req = (2 * π * R_EARTH) * (realDiameter1 / realDiameter2)
    let requiredBaselineMeters = null;
    if (isFinite(__baselineRealDiameterMeters) && __baselineRealDiameterMeters > 0) {
      requiredBaselineMeters = (2 * Math.PI * R_EARTH) * (__baselineRealDiameterMeters / realDiameterMeters);
    }
    return { id: null, scaledDiameterMeters, tooLarge: true, requiredBaselineMeters };
  }

  // В межах — малюємо
  try {
    const id = addGeodesicCircle(scaledDiameterMeters / 2, color);
    return { id, scaledDiameterMeters, tooLarge: false, requiredBaselineMeters: null };
  } catch {
    return { id: null, scaledDiameterMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }

}

/* ─────────────────────────────────────────────────────────────
 * Хелпери для інфопанелі: назва та опис з юзер-об’єктів
 * з фолбеком на офіційну бібліотеку за libIndex.
 * Використовуй їх там, де збирається HTML картки результатів.
 * ──────────────────────────────────────────────────────────── */

function libObjByIndex(idx) {
  const lib = (typeof getUniverseLibrary === 'function') ? getUniverseLibrary() : [];
  return (typeof idx === 'number' && idx >= 0 && lib[idx]) ? lib[idx] : null;
}

/**
 * Повертає коректну назву для відображення.
 * @param {{name?:string, libIndex?:number}} obj
 */
export function displayNameFor(obj) {
  const lang = getCurrentLang();
  if (obj && typeof obj.name === 'string' && obj.name) return obj.name; // юзер-об'єкт
  const lo = obj ? libObjByIndex(obj.libIndex) : null;
  return lo ? (lo[`name_${lang}`] || '') : '';
}

/**
 * Повертає коректний опис для відображення.
 * @param {{description?:string, libIndex?:number}} obj
 */
export function displayDescFor(obj) {
  const lang = getCurrentLang();
  if (obj && typeof obj.description === 'string' && obj.description) return obj.description; // юзер-опис
  const lo = obj ? libObjByIndex(obj.libIndex) : null;
  return lo ? (lo[`description_${lang}`] || '') : '';
}
