// full/js/calc/calculate_geo_area.js
'use strict';

/**
 * Калькулятор для режиму «Географія → Площа».
 * Лише математика. Жодного DOM, i18n чи рендера.
 *
 * Правило масштабу: площа кола ∝ площі об’єкта.
 * Формула для порівняння (О2 відносно О1):
 *   D2 = D1 * sqrt(S2 / S1)   ⇒   r2 = (D1/2) * sqrt(S2 / S1)
 *
 * Експорти:
 *  - setGeoAreaBaseline({ valueReal, unit, circleDiameterMeters, color }) → { currentScaleArea }
 *  - addGeoAreaCircle({ valueReal, unit, color }) → { id, scaledRadiusMeters, tooLarge, requiredBaselineMeters }
 *  - resetGeoAreaScale()
 *  - getGeoAreaScale()
 */

// Середній радіус Землі (м)
const EARTH_RADIUS_M = 6371008.8;
// Граничний геодезичний радіус (антипод): π·R_earth
const LIM_RADIUS = Math.PI * EARTH_RADIUS_M;

let __idSeq = 1;

/** Внутрішній baseline */
let __baseline = {
  valueReal: NaN,           // S1 (реальна площа)
  unit: 'km²',
  circleDiameterMeters: 0,  // D1 (діаметр базового кола)
  color: undefined
};

/** Поточний «масштаб площі»: скільки м² кола на 1 одиницю площі */
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
export function setGeoAreaBaseline({ valueReal, unit = 'km²', circleDiameterMeters = 0, color } = {}) {
  const s1 = Number(valueReal);
  const d1 = Number(circleDiameterMeters);

  __baseline.valueReal = Number.isFinite(s1) && s1 > 0 ? s1 : NaN;
  __baseline.unit = unit || 'km²';
  __baseline.circleDiameterMeters = Number.isFinite(d1) && d1 >= 0 ? d1 : 0;
  __baseline.color = color;

  // Масштаб площі: A1 / S1 (нуль, якщо щось невалідне)
  const A1 = circleAreaByD(__baseline.circleDiameterMeters);
  __currentScaleArea = (Number.isFinite(s1) && s1 > 0 && A1 > 0) ? (A1 / s1) : 0;

  return { currentScaleArea: __currentScaleArea };
}

/**
 * Додати коло для О2.
 * Повертає геодезичний радіус у метрах для рендера.
 * @returns {{ id:number, scaledRadiusMeters:number, tooLarge:boolean, requiredBaselineMeters:number }}
 */
export function addGeoAreaCircle({ valueReal, unit = 'km²', color } = {}) {
  const s2 = Number(valueReal);
  const s1 = __baseline.valueReal;
  const d1 = __baseline.circleDiameterMeters;

  // Якщо дані невалідні — повертаємо нульовий результат
  if (!Number.isFinite(s2) || s2 <= 0 || !Number.isFinite(s1) || s1 <= 0 || d1 <= 0) {
    return { id: __idSeq++, scaledRadiusMeters: 0, tooLarge: false, requiredBaselineMeters: 0 };
  }

  // r2 = (D1/2) * sqrt(S2/S1)
  const r2 = (d1 / 2) * Math.sqrt(s2 / s1);

  // Позначаємо «занадто велике коло», якщо r2 ≥ π·R_earth (антипод)
  const tooLarge = r2 >= LIM_RADIUS;

  // Якщо занадто велике, підкажемо який D1 потрібен, аби помістилось:
  //   r2 = (D1/2)*sqrt(S2/S1) < LIM_RADIUS  ⇒  D1 < 2 * LIM_RADIUS * sqrt(S1 / S2)
  let requiredBaselineMeters = 0;
  if (tooLarge) {
    requiredBaselineMeters = 2 * LIM_RADIUS * Math.sqrt(s1 / s2);
  }

  return {
    id: __idSeq++, 
    scaledRadiusMeters: r2,
    tooLarge,
    requiredBaselineMeters
  };
}

export function resetGeoAreaScale() {
  __baseline = { valueReal: NaN, unit: 'km²', circleDiameterMeters: 0, color: undefined };
  __currentScaleArea = 0;
}

export function getGeoAreaScale() {
  return __currentScaleArea;
}
