// full/js/calc/calculate_distance.js
'use strict';

import { convertUnit } from '../utils/unit_converter.js';
import { addGeodesicCircle } from '../globe/circles.js';

// Окремий стан ДЛЯ РЕЖИМУ "ВІДСТАНЬ"
let currentScale = null;               // S = Dmap(O1) / Dreal(O1)
let __baselineId = null;               // id намальованого базового кола (якщо воно в межах)
let __baselineRealDiameterMeters = null; // реальний діаметр О1 (у метрах) — потрібен для порога "антиподу"

// Константи сфери Землі
const R_EARTH = 6_371_000;           // м
const LIM_RADIUS = Math.PI * R_EARTH; // радіус на карті, що відповідає антиподу
const EPS_M = 1;                      // м, допуск на рівність/похибку

// Скидання стану при глобальному UI reset
window.addEventListener('orbit:ui-reset', () => {
  currentScale = null;
  __baselineId = null;
  __baselineRealDiameterMeters = null;
});

export function getDistanceScale() {
  return currentScale;
}

export function resetDistanceScale() {
  currentScale = null;
  __baselineId = null;
  __baselineRealDiameterMeters = null;
}

/**
 * Встановлює базовий масштаб для режиму "Відстань" і (якщо можливо) малює коло О1.
 * @param {number} realDiameterVal      Реальний діаметр О1
 * @param {string} realDiameterUnit     Одиниця (напр., "km")
 * @param {number} circleDiameterMeters Діаметр базового кола на мапі (м)
 * @param {string} color                Колір базового кола
 * @returns {string|null}               id намальованого кола або null (якщо занадто велике)
 */
export function setDistanceBaseline(realDiameterVal, realDiameterUnit, circleDiameterMeters, color) {
  // 1) Підрахунок масштабу
  const realMeters = Number(convertUnit(realDiameterVal, realDiameterUnit, 'm', 'diameter'));
  const circleDM = Number(circleDiameterMeters);

  __baselineId = null;
  __baselineRealDiameterMeters = null;
  currentScale = null;

  if (!isFinite(realMeters) || realMeters <= 0 || !isFinite(circleDM) || circleDM <= 0) {
    return null;
  }

  currentScale = circleDM / realMeters;
  __baselineRealDiameterMeters = realMeters;

  // 2) Межа візуалізації базового кола: якщо радіус > πR — НЕ малюємо (масштаб залишається)
  const r = circleDM / 2;
  if (r > LIM_RADIUS + EPS_M) {
    return null; // інфопанель покаже базу, але без геометрії
  }

  // 3) Малюємо базове коло (як довідкове), якщо воно в межах
  try {
    __baselineId = addGeodesicCircle(r, color, __baselineId);
  } catch {
    __baselineId = null;
  }
  return __baselineId;
}

/**
 * Додає коло для О2 у режимі "Відстань".
 * Радіус кола на мапі = (реальна відстань до Землі) × S.
 *
 * Якщо радіус >= πR + EPS — НІЧОГО не малюємо, а повертаємо:
 *  - tooLarge = true
 *  - requiredBaselineMeters = діаметр базового кола О1 (на мапі), за якого О2 став би рівно антиподом.
 *
 * @param {number} realDistanceVal   Реальна відстань до Землі (О2)
 * @param {string} realDistanceUnit  Одиниця (напр., "km", "AU", "ly", ...)
 * @param {string} color             Колір кола О2
 * @returns {{id:string|null, scaledRadiusMeters:number|null, tooLarge:boolean, requiredBaselineMeters:number|null}}
 */
export function addDistanceCircle(realDistanceVal, realDistanceUnit, color) {
  if (currentScale == null || !(currentScale > 0)) {
    return { id: null, scaledRadiusMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }

  const realDistMeters = Number(convertUnit(realDistanceVal, realDistanceUnit, 'm', 'distance'));
  if (!isFinite(realDistMeters) || realDistMeters <= 0) {
    return { id: null, scaledRadiusMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }

  const scaledRadiusMeters = realDistMeters * currentScale;

  // Перевірка порогу антиподу
  if (scaledRadiusMeters > LIM_RADIUS + EPS_M) {
    // Потрібний базовий діаметр О1 на мапі, щоб О2 став рівно антиподом:
    // S_req = (πR) / realDistMeters
    // Dmap1_req = S_req * realDiameter1 = (πR * realDiameter1) / realDistMeters
    let requiredBaselineMeters = null;
    if (isFinite(__baselineRealDiameterMeters) && __baselineRealDiameterMeters > 0) {
      requiredBaselineMeters = (Math.PI * R_EARTH * __baselineRealDiameterMeters) / realDistMeters;
    }
    return { id: null, scaledRadiusMeters, tooLarge: true, requiredBaselineMeters };
  }

  // В межах — малюємо
  try {
    const id = addGeodesicCircle(scaledRadiusMeters, color);
    return { id, scaledRadiusMeters, tooLarge: false, requiredBaselineMeters: null };
  } catch {
    return { id: null, scaledRadiusMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }
}
