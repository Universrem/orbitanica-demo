// full/js/calc/calculate_mass.js
'use strict';

/**
 * Калькулятор для режиму «Маса».
 * Лише математика. Жодного DOM, i18n чи рендера.
 *
 * Правило масштабу: площа кола ∝ масі.
 * Формула для порівняння (О2 відносно О1):
 *   D2 = D1 * sqrt(M2 / M1)   ⇒   r2 = (D1/2) * sqrt(M2 / M1)
 *
 * Експорти:
 *  - setMassBaseline({ valueReal, unit, circleDiameterMeters, color }) → { currentScaleArea }
 *  - addMassCircle({ valueReal, unit, color }) → { id, scaledRadiusMeters, tooLarge, requiredBaselineMeters }
 *  - resetMassScale()
 *  - getMassScale()
 */

// Середній радіус Землі (м)
const EARTH_RADIUS_M = 6371008.8;
// Граничний геодезичний радіус (антипод): π·R_earth
const LIM_RADIUS = Math.PI * EARTH_RADIUS_M;

let __idSeq = 1;

/** Внутрішній baseline */
let __baseline = {
  valueReal: NaN,           // M1 (у базовій одиниці маси)
  unit: 'M⊕',               // лише довідковий підпис; обчислення йдуть по valueReal
  circleDiameterMeters: 0,  // D1 (м)
  color: undefined
};

/** Поточний «масштаб площі»: скільки м² кола на 1 базову одиницю маси */
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
export function setMassBaseline({ valueReal, unit = 'M⊕', circleDiameterMeters = 0, color } = {}) {
  const m1 = Number(valueReal);
  const d1 = Number(circleDiameterMeters);

  __baseline.valueReal = Number.isFinite(m1) && m1 > 0 ? m1 : NaN;
  __baseline.unit = unit || 'M⊕';
  __baseline.circleDiameterMeters = Number.isFinite(d1) && d1 >= 0 ? d1 : 0;
  __baseline.color = color;

  // Масштаб площі: A1 / M1 (нуль, якщо щось невалідне)
  const A1 = circleAreaByD(__baseline.circleDiameterMeters);
  __currentScaleArea = (Number.isFinite(m1) && m1 > 0 && A1 > 0) ? (A1 / m1) : 0;

  return { currentScaleArea: __currentScaleArea };
}

/**
 * Додати коло для О2.
 * Повертає геодезичний радіус у метрах для рендера.
 * @returns {{ id:number, scaledRadiusMeters:number, tooLarge:boolean, requiredBaselineMeters:number }}
 */
export function addMassCircle({ valueReal, unit = 'M⊕', color } = {}) {
  const m2 = Number(valueReal);
  const m1 = __baseline.valueReal;
  const d1 = __baseline.circleDiameterMeters;

  // Якщо дані невалідні — повертаємо нульовий результат
  if (!Number.isFinite(m2) || m2 <= 0 || !Number.isFinite(m1) || m1 <= 0 || d1 <= 0) {
    return { id: __idSeq++, scaledRadiusMeters: 0, tooLarge: false, requiredBaselineMeters: 0 };
  }

  // r2 = (D1/2) * sqrt(M2/M1)
  const r2 = (d1 / 2) * Math.sqrt(m2 / m1);

  // Позначаємо «занадто велике коло», якщо r2 ≥ π·R_earth (антипод)
  const tooLarge = r2 >= LIM_RADIUS;

  // Якщо занадто велике, підкажемо який D1 потрібен, аби помістилось:
  //   r2 = (D1/2)*sqrt(M2/M1) < LIM_RADIUS  ⇒  D1 < 2 * LIM_RADIUS * sqrt(M1 / M2)
  let requiredBaselineMeters = 0;
  if (tooLarge) {
    requiredBaselineMeters = 2 * LIM_RADIUS * Math.sqrt(m1 / m2);
  }

  return {
    id: __idSeq++,
    scaledRadiusMeters: r2,
    tooLarge,
    requiredBaselineMeters
  };
}

export function resetMassScale() {
  __baseline = { valueReal: NaN, unit: 'M⊕', circleDiameterMeters: 0, color: undefined };
  __currentScaleArea = 0;
}

export function getMassScale() {
  return __currentScaleArea;
}
