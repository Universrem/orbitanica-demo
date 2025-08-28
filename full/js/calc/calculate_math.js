// full/js/calc/calculate_math.js
'use strict';

/**
 * Еталонний калькулятор для режиму «Математика».
 * Лише математика. Жодного DOM, i18n чи рендера.
 *
 * Правило масштабу: площа кола ∝ числу.
 * Формула для порівняння (О2 відносно О1):
 *   D2 = D1 * sqrt(V2 / V1)   ⇒   r2 = (D1/2) * sqrt(V2 / V1)
 *
 * Експорти:
 *  - setMathBaseline({ valueReal, unit, circleDiameterMeters, color }) → { currentScaleArea }
 *  - addMathCircle({ valueReal, unit, color }) → { id, scaledRadiusMeters, tooLarge, requiredBaselineMeters }
 *  - resetMathScale()
 *  - getMathScale()
 */

// Середній радіус Землі (м)
const EARTH_RADIUS_M = 6371008.8;
// Граничний геодезичний радіус (антипод): π·R_earth
const LIM_RADIUS = Math.PI * EARTH_RADIUS_M;

let __idSeq = 1;

/** Внутрішній baseline */
let __baseline = {
  valueReal: NaN,           // V1
  unit: 'unit',
  circleDiameterMeters: 0,  // D1
  color: undefined
};

/** Поточний «масштаб площі»: скільки м² кола на 1 одиницю числа */
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
export function setMathBaseline({ valueReal, unit = 'unit', circleDiameterMeters = 0, color } = {}) {
  const v1 = Number(valueReal);
  const d1 = Number(circleDiameterMeters);

  __baseline.valueReal = Number.isFinite(v1) && v1 > 0 ? v1 : NaN;
  __baseline.unit = unit || 'unit';
  __baseline.circleDiameterMeters = Number.isFinite(d1) && d1 >= 0 ? d1 : 0;
  __baseline.color = color;

  // Масштаб площі: A1 / V1 (нуль, якщо щось невалідне)
  const A1 = circleAreaByD(__baseline.circleDiameterMeters);
  __currentScaleArea = (Number.isFinite(v1) && v1 > 0 && A1 > 0) ? (A1 / v1) : 0;

  return { currentScaleArea: __currentScaleArea };
}

/**
 * Додати коло для О2.
 * Повертає геодезичний радіус у метрах для рендера.
 * @returns {{ id:number, scaledRadiusMeters:number, tooLarge:boolean, requiredBaselineMeters:number }}
 */
export function addMathCircle({ valueReal, unit = 'unit', color } = {}) {
  const v2 = Number(valueReal);
  const v1 = __baseline.valueReal;
  const d1 = __baseline.circleDiameterMeters;

  // Якщо дані невалідні — повертаємо нульовий результат
  if (!Number.isFinite(v2) || v2 <= 0 || !Number.isFinite(v1) || v1 <= 0 || d1 <= 0) {
    return { id: __idSeq++, scaledRadiusMeters: 0, tooLarge: false, requiredBaselineMeters: 0 };
  }

  // r2 = (D1/2) * sqrt(V2/V1)
  const r2 = (d1 / 2) * Math.sqrt(v2 / v1);

  // Позначаємо «занадто велике коло», якщо r2 ≥ π·R_earth (антипод)
  const tooLarge = r2 >= LIM_RADIUS;

  // Якщо занадто велике, підкажемо який D1 потрібен, аби помістилось:
  //   r2 = (D1/2)*sqrt(V2/V1) < LIM_RADIUS  ⇒  D1 < 2 * LIM_RADIUS * sqrt(V1 / V2)
  let requiredBaselineMeters = 0;
  if (tooLarge) {
    requiredBaselineMeters = 2 * LIM_RADIUS * Math.sqrt(v1 / v2);
  }

  return {
    id: __idSeq++,
    scaledRadiusMeters: r2,
    tooLarge,
    requiredBaselineMeters
  };
}

export function resetMathScale() {
  __baseline = { valueReal: NaN, unit: 'unit', circleDiameterMeters: 0, color: undefined };
  __currentScaleArea = 0;
}

export function getMathScale() {
  return __currentScaleArea;
}
