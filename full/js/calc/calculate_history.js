// full/js/calc/calculate_history.js
'use strict';

import { addGeodesicCircle } from '../globe/circles.js';

// Стан режиму "Історія"
let currentScale = null;     // метрів на 1 рік
let __baselineId = null;
let __baselineYearsForScale = null; // за якою часовою відстанню з О1 задавали масштаб (зазвичай "початок")

// Константи сфери Землі
const R_EARTH = 6_371_000;            // м
const LIM_RADIUS = Math.PI * R_EARTH; // максимум (антипод)
const EPS_M = 1;                      // допуск

// reset усієї UI
window.addEventListener('orbit:ui-reset', () => {
  currentScale = null;
  __baselineId = null;
  __baselineYearsForScale = null;
});

/**
 * Встановлює масштаб для режиму "Історія" і малює базове коло О1 (за введеним діаметром).
 * @param {number} yearsForScale          Скільки років від події О1 до 2025 (беремо валідне значення — зазвичай початок)
 * @param {number} circleDiameterMeters   Діаметр кола для О1 (користувацький)
 * @param {string} color                  Колір кола
 * @returns {{id: string|null, scaledRadiusMeters: number|null, tooLarge: boolean, requiredBaselineMeters: number|null}}
 */
export function setHistoryBaseline(yearsForScale, circleDiameterMeters, color = 'rgba(255,0,0,0.95)') {
  currentScale = null;
  __baselineId = null;
  __baselineYearsForScale = null;

  const Y = Number(yearsForScale);
  const Dm = Number(circleDiameterMeters);
  if (!isFinite(Y) || Y <= 0 || !isFinite(Dm) || Dm <= 0) {
    return { id: null, scaledRadiusMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }

  const radius = Dm / 2;

  // Перевірка межі (антипод)
  if (radius > LIM_RADIUS - EPS_M) {
    // підкажемо максимально допустимий діаметр
    const requiredBaselineMeters = 2 * LIM_RADIUS;
    return { id: null, scaledRadiusMeters: radius, tooLarge: true, requiredBaselineMeters };
  }

  // Масштаб: скільки метрів відповідає одному року
  currentScale = radius / Y;
  __baselineYearsForScale = Y;

  try {
    const id = addGeodesicCircle(radius, color);
    __baselineId = id || null;
    return { id, scaledRadiusMeters: radius, tooLarge: false, requiredBaselineMeters: null };
  } catch {
    return { id: null, scaledRadiusMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }
}

/**
 * Додає коло для довільної події (О1-кінець або О2), використовуючи вже встановлений масштаб.
 * @param {number} yearsFromNow  Скільки років від події до 2025
 * @param {string} color         Колір кола
 * @returns {{id: string|null, scaledRadiusMeters: number|null, tooLarge: boolean, requiredBaselineMeters: number|null}}
 */
export function addHistoryCircle(yearsFromNow, color = 'rgba(0,0,255,0.95)') {
  if (!isFinite(currentScale) || currentScale <= 0) {
    return { id: null, scaledRadiusMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }
  const Y = Number(yearsFromNow);
  if (!isFinite(Y) || Y <= 0) {
    return { id: null, scaledRadiusMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }

  const radius = Y * currentScale;

  if (radius > LIM_RADIUS - EPS_M) {
    // Якого базового діаметра достатньо, щоб ця подія вмістилася?
    // Маємо: S' = (D1' / 2) / years1   і   Y2 * S' ≤ LIM_RADIUS
    // => D1' ≤ 2 * LIM_RADIUS * (years1 / Y2)
    let requiredBaselineMeters = null;
    if (isFinite(__baselineYearsForScale) && __baselineYearsForScale > 0) {
      requiredBaselineMeters = 2 * LIM_RADIUS * (__baselineYearsForScale / Y);
    }
    return { id: null, scaledRadiusMeters: radius, tooLarge: true, requiredBaselineMeters };
  }

  try {
    const id = addGeodesicCircle(radius, color);
    return { id, scaledRadiusMeters: radius, tooLarge: false, requiredBaselineMeters: null };
  } catch {
    return { id: null, scaledRadiusMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }
}
