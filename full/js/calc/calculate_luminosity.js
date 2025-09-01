// full/js/calc/calculate_luminosity.js
'use strict';

/**
 * Калькулятор для режиму «Світність».
 * Лише математика. Жодного DOM, i18n чи рендера.
 *
 * Правило масштабу: площа кола ∝ світності.
 * Формула для порівняння (О2 відносно О1):
 *   D2 = D1 * sqrt(L2 / L1)   ⇒   r2 = (D1/2) * sqrt(L2 / L1)
 *
 * Експорти:
 *  - setLuminosityBaseline({ valueReal, unit, circleDiameterMeters, color }) → { currentScaleArea }
 *  - addLuminosityCircle({ valueReal, unit, color }) → { id, scaledRadiusMeters, tooLarge, requiredBaselineMeters }
 *  - resetLuminosityScale()
 *  - getLuminosityScale()
 */

// Середній радіус Землі (м)
const EARTH_RADIUS_M = 6371008.8;
// Граничний геодезичний радіус (антипод): π·R_earth
const LIM_RADIUS = Math.PI * EARTH_RADIUS_M;

let __idSeq = 1;

/** Внутрішній baseline */
let __baseline = {
  valueReal: NaN,           // L1 (Вт)
  unit: 'W',
  circleDiameterMeters: 0,  // D1 (м)
  color: undefined
};

/** Поточний «масштаб площі»: скільки м² кола на 1 Вт світності */
let __currentScaleArea = 0;

/** Площа кола за діаметром */
function circleAreaByD(d) {
  const D = Number(d);
  if (!Number.isFinite(D) || D <= 0) return 0;
  return Math.PI * (D * D) / 4;
}

/**
 * Встановити базову величину (О1) і обчислити масштаб площі.
 * @returns {{ currentScaleArea: number }}
 */
export function setLuminosityBaseline({ valueReal, unit = 'W', circleDiameterMeters = 0, color } = {}) {
  const l1 = Number(valueReal);
  const d1 = Number(circleDiameterMeters);

  __baseline.valueReal = Number.isFinite(l1) && l1 > 0 ? l1 : NaN;
  __baseline.unit = unit || 'W';
  __baseline.circleDiameterMeters = Number.isFinite(d1) && d1 >= 0 ? d1 : 0;
  __baseline.color = color;

  // Масштаб площі: A1 / L1 (нуль, якщо щось невалідне)
  const A1 = circleAreaByD(__baseline.circleDiameterMeters);
  __currentScaleArea = (Number.isFinite(l1) && l1 > 0 && A1 > 0) ? (A1 / l1) : 0;

  return { currentScaleArea: __currentScaleArea };
}

/**
 * Додати коло для О2.
 * Повертає геодезичний радіус у метрах для рендера.
 * @returns {{ id:number, scaledRadiusMeters:number, tooLarge:boolean, requiredBaselineMeters:number }}
 */
export function addLuminosityCircle({ valueReal, unit = 'W', color } = {}) {
  const l2 = Number(valueReal);
  const l1 = __baseline.valueReal;
  const d1 = __baseline.circleDiameterMeters;

  // Якщо дані невалідні — повертаємо нульовий результат
  if (!Number.isFinite(l2) || l2 <= 0 || !Number.isFinite(l1) || l1 <= 0 || d1 <= 0) {
    return { id: __idSeq++, scaledRadiusMeters: 0, tooLarge: false, requiredBaselineMeters: 0 };
  }

  // r2 = (D1/2) * sqrt(L2/L1)
  const r2 = (d1 / 2) * Math.sqrt(l2 / l1);

  // Позначаємо «занадто велике коло», якщо r2 ≥ π·R_earth (антипод)
  const tooLarge = r2 >= LIM_RADIUS;

  // Якщо занадто велике, підкажемо який D1 потрібен, аби помістилось:
  //   r2 = (D1/2)*sqrt(L2/L1) < LIM_RADIUS  ⇒  D1 < 2 * LIM_RADIUS * sqrt(L1 / L2)
  let requiredBaselineMeters = 0;
  if (tooLarge) {
    requiredBaselineMeters = 2 * LIM_RADIUS * Math.sqrt(l1 / l2);
  }

  return {
    id: __idSeq++,
    scaledRadiusMeters: r2,
    tooLarge,
    requiredBaselineMeters
  };
}

export function resetLuminosityScale() {
  __baseline = { valueReal: NaN, unit: 'W', circleDiameterMeters: 0, color: undefined };
  __currentScaleArea = 0;
}

export function getLuminosityScale() {
  return __currentScaleArea;
}
