// full/js/calc/calculate_history.js
'use strict';

/**
 * Еталонний калькулятор для режиму «Історія».
 * Лише математика. Жодних слухачів подій, DOM, i18n чи рендера.
 *
 * Правило масштабу (лінійне):
 *   r ∝ |pivotYear - year|
 *
 * Базу задає О1-start:
 *   yearsForScale = |pivotYear - time_start(O1)|
 *   scaledDiameterMeters = введений КОРИСТУВАЧЕМ діаметр кола О1-start (м)
 *   S (м/рік) = (scaledDiameterMeters / 2) / yearsForScale
 *
 * Експорти:
 *  - setHistoryBaseline({ yearsForScale, circleDiameterMeters, color, pivotYear }) → { currentScaleLinear }
 *  - addHistoryCircle({ year, yearsFromNow, pivotYear, color }) → { id, scaledRadiusMeters, tooLarge, requiredBaselineMeters, usedScaleMetersPerYear }
 *  - resetHistoryScale()
 *  - getHistoryScale()
 */

// Середній радіус Землі (м)
const EARTH_RADIUS_M = 6371008.8;
// Граничний геодезичний радіус (антипод): π·R_earth
const LIM_RADIUS = Math.PI * EARTH_RADIUS_M;

let __idSeq = 1;

/** Внутрішній baseline */
let __baseline = {
  yearsForScale: NaN,       // |pivotYear - time_start(O1)|
  circleDiameterMeters: 0,  // введений діаметр О1-start (м)
  color: undefined,
  pivotYear: NaN
};

/** Поточний «лінійний» масштаб: скільки метрів радіуса на 1 рік */
let __currentScaleLinear = 0;

/** Поточний pivot-рік (центр відліку) */
function currentPivotYear() {
  if (Number.isFinite(__baseline.pivotYear)) return __baseline.pivotYear;
  try {
    const w = (typeof window !== 'undefined') ? window : {};
    if (w.orbit && Number.isFinite(w.orbit.historyPivotYear)) {
      return Number(w.orbit.historyPivotYear);
    }
  } catch {}
  const now = new Date();
  return now.getFullYear();
}

/** |pivot - year| з урахуванням від’ємних років (до н.е.) */
function yearsFromPivot(year, pivot) {
  const y = Number(year);
  const p = Number(pivot);
  if (!Number.isFinite(y) || !Number.isFinite(p)) return NaN;
  return Math.abs(p - y);
}

/**
 * Встановити базову величину (О1-start) і обчислити лінійний масштаб.
 * @param {{ yearsForScale:number, circleDiameterMeters:number, color?:string, pivotYear?:number }} args
 * @returns {{ currentScaleLinear:number }}
 */
export function setHistoryBaseline({ yearsForScale, circleDiameterMeters = 0, color, pivotYear } = {}) {
  const ys = Number(yearsForScale);
  const d1 = Number(circleDiameterMeters);

  __baseline.yearsForScale = Number.isFinite(ys) && ys > 0 ? ys : NaN;
  __baseline.circleDiameterMeters = Number.isFinite(d1) && d1 >= 0 ? d1 : 0;
  __baseline.color = color;
  __baseline.pivotYear = Number.isFinite(pivotYear) ? Number(pivotYear) : NaN;

  // S = (D1/2) / yearsForScale
  __currentScaleLinear =
    (Number.isFinite(__baseline.yearsForScale) && __baseline.yearsForScale > 0 && d1 > 0)
      ? (d1 / 2) / __baseline.yearsForScale
      : 0;

  return { currentScaleLinear: __currentScaleLinear };
}

/**
 * Додати коло для події (будь-яка дата). Повертає геодезичний радіус у метрах.
 * Можна передати або { yearsFromNow }, або { year } (+ опційно pivotYear).
 *
 * @param {{ year?:number, yearsFromNow?:number, pivotYear?:number, color?:string }} args
 * @returns {{ id:number, scaledRadiusMeters:number, tooLarge:boolean, requiredBaselineMeters:number, usedScaleMetersPerYear:number }}
 */
export function addHistoryCircle({ year, yearsFromNow, pivotYear, color } = {}) {
  const S = __currentScaleLinear;

  // Обчислимо years з пріоритетом до явно переданого yearsFromNow
  let y = Number(yearsFromNow);
  if (!Number.isFinite(y)) {
    const pivot = Number.isFinite(pivotYear) ? Number(pivotYear) : currentPivotYear();
    y = yearsFromPivot(year, pivot);
  }

  // Якщо дані невалідні — повертаємо нульовий результат
  if (!Number.isFinite(y) || y < 0 || S <= 0) {
    return {
      id: __idSeq++,
      scaledRadiusMeters: 0,
      tooLarge: false,
      requiredBaselineMeters: 0,
      usedScaleMetersPerYear: 0
    };
  }

  // r = S * years
  const r = S * y;

  // Позначаємо «занадто велике коло», якщо r ≥ π·R_earth (антипод)
  const tooLarge = r >= LIM_RADIUS;

  // Якщо занадто велике, підкажемо граничний D1, аби помістилось:
  //   r = (D1/2) * (years / yearsForScale) < LIM_RADIUS
  //   ⇒ D1 < 2 * LIM_RADIUS * (yearsForScale / years)
  let requiredBaselineMeters = 0;
  if (tooLarge) {
    const ys = __baseline.yearsForScale;
    if (Number.isFinite(ys) && ys > 0 && y > 0) {
      requiredBaselineMeters = 2 * LIM_RADIUS * (ys / y);
    }
  }

  return {
    id: __idSeq++,
    scaledRadiusMeters: r,
    tooLarge,
    requiredBaselineMeters,
    usedScaleMetersPerYear: S
  };
}

export function resetHistoryScale() {
  __baseline = {
    yearsForScale: NaN,
    circleDiameterMeters: 0,
    color: undefined,
    pivotYear: NaN
  };
  __currentScaleLinear = 0;
  __idSeq = 1; // після повного ресету ідентифікація кіл починається знову
}

export function getHistoryScale() {
  return __currentScaleLinear;
}
