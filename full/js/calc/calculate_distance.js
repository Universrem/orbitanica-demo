// full/js/calc/calculate_distance.js
'use strict';

/**
 * Калькулятор для режиму «Відстань».
 * Лише математика. Жодного DOM, i18n чи рендера.
 *
 * Правило масштабу (лінійне): D1 (м) відповідає realDiameter(O1) (у баз. од. distance, напр. км).
 * Масштаб (метрів на 1 базову одиницю відстані):
 *   k = D1 / realDiameter(O1)
 *
 * Для О2 використовуємо distance_to_earth (у баз. од.). Радіус кола:
 *   r2 = k * distance_to_earth(O2)
 *
 * Експорти:
 *  - setDistanceBaseline({ valueReal, unit, circleDiameterMeters, color }) → { currentLinearScale }
 *      valueReal — реальний діаметр О1 у базових одиницях (напр. км)
 *  - addDistanceCircle({ valueReal, unit, color }) → { id, scaledRadiusMeters, tooLarge, requiredBaselineMeters }
 *      valueReal — distance_to_earth О2 у базових одиницях (напр. км)
 *  - resetDistanceScale()
 *  - getDistanceScale() → поточний масштаб (м на 1 базову од.)
 */

// Середній радіус Землі (м)
const EARTH_RADIUS_M = 6371008.8;
// Граничний геодезичний радіус (антипод): π·R_earth
const LIM_RADIUS = Math.PI * EARTH_RADIUS_M;

let __idSeq = 1;

/** Внутрішній baseline */
let __baseline = {
  valueReal: NaN,           // реальний діаметр О1 у базових одиницях (напр. км)
  unit: 'km',               // довідковий підпис; у формулах не використовується
  circleDiameterMeters: 0,  // D1 (м)
  color: undefined
};

/** Поточний лінійний масштаб: метрів на 1 базову одиницю (k = D1 / realDiameter) */
let __currentLinearScale = 0;

/**
 * Встановити базову величину (О1) і обчислити лінійний масштаб.
 * @returns {{ currentLinearScale: number }}
 */
export function setDistanceBaseline({ valueReal, unit = 'km', circleDiameterMeters = 0, color } = {}) {
  const realDiameterBase = Number(valueReal);
  const d1 = Number(circleDiameterMeters);

  __baseline.valueReal = Number.isFinite(realDiameterBase) && realDiameterBase > 0 ? realDiameterBase : NaN;
  __baseline.unit = unit || 'km';
  __baseline.circleDiameterMeters = Number.isFinite(d1) && d1 >= 0 ? d1 : 0;
  __baseline.color = color;

  // k = D1 / realDiameter(O1)  (м на 1 базову од.)
  __currentLinearScale =
    (Number.isFinite(__baseline.valueReal) && __baseline.valueReal > 0 && d1 > 0)
      ? (d1 / __baseline.valueReal)
      : 0;

  return { currentLinearScale: __currentLinearScale };
}

/**
 * Додати коло для О2.
 * valueReal — distance_to_earth у базових одиницях (напр. км)
 * Повертає геодезичний радіус у метрах для рендера.
 * @returns {{ id:number, scaledRadiusMeters:number, tooLarge:boolean, requiredBaselineMeters:number }}
 */
export function addDistanceCircle({ valueReal, unit = 'km', color } = {}) {
  const distBase = Number(valueReal);
  const d1 = __baseline.circleDiameterMeters;
  const realDiameterBase = __baseline.valueReal;

  // Якщо дані невалідні — повертаємо нульовий результат
  if (!Number.isFinite(distBase) || distBase <= 0 || !Number.isFinite(realDiameterBase) || realDiameterBase <= 0 || d1 <= 0) {
    return { id: __idSeq++, scaledRadiusMeters: 0, tooLarge: false, requiredBaselineMeters: 0 };
    }

  // r2 = k * distance_to_earth = (D1 / realDiameter) * dist
  const r2 = __currentLinearScale * distBase;

  // Позначаємо «занадто велике коло», якщо r2 ≥ π·R_earth (антипод)
  const tooLarge = r2 >= LIM_RADIUS;

  // Якщо занадто велике, підкажемо який D1 потрібен, аби помістилось:
  //   r2 = (D1 / realDiameter) * dist < LIM_RADIUS
  //   ⇒ D1 < LIM_RADIUS * realDiameter / dist
  let requiredBaselineMeters = 0;
  if (tooLarge) {
    requiredBaselineMeters = (LIM_RADIUS * realDiameterBase) / distBase;
  }

  return {
    id: __idSeq++,
    scaledRadiusMeters: r2,
    tooLarge,
    requiredBaselineMeters
  };
}

export function resetDistanceScale() {
  __baseline = { valueReal: NaN, unit: 'km', circleDiameterMeters: 0, color: undefined };
  __currentLinearScale = 0;
}

export function getDistanceScale() {
  return __currentLinearScale;
}
