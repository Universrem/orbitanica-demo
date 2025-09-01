// full/js/calc/calculate_diameter.js
'use strict';

/**
 * Калькулятор для режиму «Діаметр».
 * Лише математика. Жодного DOM, i18n чи рендера.
 *
 * Правило масштабу (лінійне, бо порівнюємо діаметри):
 *   D2 = D1 * (V2 / V1)   ⇒   r2 = (D1/2) * (V2 / V1)
 * де:
 *   V1 — реальний діаметр О1 (в метрах),
 *   D1 — базовий діаметр кола О1 (в метрах, на глобусі),
 *   V2 — реальний діаметр О2 (в метрах),
 *   r2 — геодезичний радіус кола О2, м.
 *
 * Експорти:
 *  - setDiameterBaseline({ diameterReal, unit, circleDiameterMeters, color }) → { currentScaleLinear }
 *  - addDiameterCircle({ diameterReal, unit, color }) → { id, scaledRadiusMeters, tooLarge, requiredBaselineMeters }
 *  - resetDiameterScale()
 *  - getDiameterScale()
 */

// Середній радіус Землі (м)
const EARTH_RADIUS_M = 6371008.8;
// Граничний геодезичний радіус (антипод): π·R_earth
const LIM_RADIUS = Math.PI * EARTH_RADIUS_M;

let __idSeq = 1;

/** Внутрішній baseline */
let __baseline = {
  diameterReal: NaN,        // V1 (м)
  unit: 'm',
  circleDiameterMeters: 0,  // D1 (м)
  color: undefined
};

/** Поточний «лінійний масштаб»: скільки метрів діаметра кола на 1 метр реального діаметра */
let __currentScaleLinear = 0;

/** Перевірка та нормалізація числа */
function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : NaN;
}

/**
 * Встановити базову величину (О1) і обчислити лінійний масштаб.
 * @returns {{ currentScaleLinear: number }}
 */
export function setDiameterBaseline({ diameterReal, unit = 'm', circleDiameterMeters = 0, color } = {}) {
  const v1 = num(diameterReal);              // V1
  const d1 = num(circleDiameterMeters);      // D1

  __baseline.diameterReal = (v1 > 0) ? v1 : NaN;
  __baseline.unit = unit || 'm';
  __baseline.circleDiameterMeters = (Number.isFinite(d1) && d1 >= 0) ? d1 : 0;
  __baseline.color = color;

  // Лінійний масштаб: D1 / V1 (0, якщо щось невалідне)
  __currentScaleLinear = (v1 > 0 && d1 > 0) ? (d1 / v1) : 0;

  return { currentScaleLinear: __currentScaleLinear };
}

/**
 * Додати коло для О2.
 * Повертає геодезичний радіус у метрах для рендера.
 */
export function addDiameterCircle({ diameterReal, unit = 'm', color } = {}) {
  const v2 = num(diameterReal);              // V2
  const v1 = __baseline.diameterReal;        // V1
  const d1 = __baseline.circleDiameterMeters;// D1

  // Якщо дані невалідні — повертаємо нульовий результат
  if (!(v2 > 0) || !(v1 > 0) || !(d1 > 0)) {
    return { id: __idSeq++, scaledRadiusMeters: 0, tooLarge: false, requiredBaselineMeters: 0 };
  }

  // r2 = (D1/2) * (V2/V1)
  const r2 = (d1 / 2) * (v2 / v1);

  // Позначаємо «занадто велике коло», якщо r2 ≥ π·R_earth (антипод)
  const tooLarge = r2 >= LIM_RADIUS;

  // Якщо занадто велике, підкажемо який D1 потрібен:
  //   r2 = (D1/2)*(V2/V1) < LIM_RADIUS  ⇒  D1 < 2 * LIM_RADIUS * (V1 / V2)
  let requiredBaselineMeters = 0;
  if (tooLarge) {
    requiredBaselineMeters = 2 * LIM_RADIUS * (v1 / v2);
  }

  return {
    id: __idSeq++,
    scaledRadiusMeters: r2,
    tooLarge,
    requiredBaselineMeters
  };
}

export function resetDiameterScale() {
  __baseline = { diameterReal: NaN, unit: 'm', circleDiameterMeters: 0, color: undefined };
  __currentScaleLinear = 0;
}

export function getDiameterScale() {
  return __currentScaleLinear;
}
