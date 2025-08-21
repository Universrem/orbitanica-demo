// full/js/calc/calculate_mass.js
'use strict';

import { convertUnit } from '../utils/unit_converter.js';
import { addGeodesicCircle } from '../globe/circles.js';

// Стан режиму "Маса" (A-вариант: D ∝ √M)
let currentScale = null;          // S = Dmap(O1) / sqrt(Mreal_kg(O1))
let __baselineId = null;
let __baselineM1kg = null;        // маса О1 (в кг)

// Константи сфери Землі
const R_EARTH = 6_371_000;            // м
const LIM_RADIUS = Math.PI * R_EARTH; // максимально допустимий радіус кола на мапі (антипод)
const EPS_M = 1;                       // м

// Скидання стану при глобальному reset
window.addEventListener('orbit:ui-reset', () => {
  currentScale = null;
  __baselineId = null;
  __baselineM1kg = null;
});

/**
 * База (О1): фіксуємо масштаб і, якщо можна, малюємо довідкове коло.
 * Масштаб: S = Dmap1 / sqrt(M1_kg)
 *
 * @param {number} realM1           Реальна маса О1
 * @param {string} realUnit1        Одиниця маси (наприклад: "kg", "M⊕", "M♃", "M☉", "t")
 * @param {number} circleDiameterMeters Діаметр базового кола на мапі (м)
 * @param {string} color            Колір базового кола
 * @returns {string|null}           id намальованого кола або null (якщо занадто велике)
 */
export function setMassBaseline(realM1, realUnit1, circleDiameterMeters, color = 'rgba(255,0,0,0.8)') {
  __baselineId = null;
  currentScale = null;
  __baselineM1kg = null;

  const M1kg = Number(convertUnit(realM1, realUnit1, 'kg', 'mass'));
  const Dm = Number(circleDiameterMeters);

  if (!isFinite(M1kg) || M1kg <= 0 || !isFinite(Dm) || Dm <= 0) return null;

  const sqrtM1 = Math.sqrt(M1kg);
  currentScale = Dm / sqrtM1;
  __baselineM1kg = M1kg;

  const r = Dm / 2;
  if (r > LIM_RADIUS + EPS_M) return null;

  try {
    __baselineId = addGeodesicCircle(r, color, __baselineId);
    return __baselineId;
  } catch {
    return null;
  }
}

/**
 * О2: масштабуємо діаметр за масою і малюємо коло (або повертаємо підказку про межу).
 * Dmap2 = S * sqrt(M2_kg)
 *
 * Якщо (Dmap2/2) > πR + EPS → НЕ малюємо, повертаємо:
 *  - tooLarge = true
 *  - requiredBaselineMeters = діаметр базового кола О1 (на мапі), за якого О2 став би рівно антиподом.
 *    Це МАКСИМАЛЬНО дозволений діаметр О1: Dmap1_req = (2πR) * sqrt(M1 / M2).
 *
 * @param {number} realM2     Реальна маса О2
 * @param {string} realUnit2  Одиниця маси О2
 * @param {string} color      Колір кола О2
 * @returns {{id:string|null, scaledDiameterMeters:number|null, tooLarge:boolean, requiredBaselineMeters:number|null}}
 */
export function addMassCircle(realM2, realUnit2, color = 'rgba(0,128,255,0.8)') {
  if (currentScale == null || !(currentScale > 0)) {
    return { id: null, scaledDiameterMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }

  const M2kg = Number(convertUnit(realM2, realUnit2, 'kg', 'mass'));
  if (!isFinite(M2kg) || M2kg <= 0) {
    return { id: null, scaledDiameterMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }

  const scaledDiameterMeters = currentScale * Math.sqrt(M2kg);

  // Перевірка межі (антипод)
  if ((scaledDiameterMeters / 2) > (LIM_RADIUS + EPS_M)) {
    let requiredBaselineMeters = null;
    if (isFinite(__baselineM1kg) && __baselineM1kg > 0) {
      // Dmap1_req = (2πR) * sqrt(M1 / M2)
      requiredBaselineMeters = (2 * Math.PI * R_EARTH) * Math.sqrt(__baselineM1kg / M2kg);
    }
    return { id: null, scaledDiameterMeters, tooLarge: true, requiredBaselineMeters };
  }

  try {
    const id = addGeodesicCircle(scaledDiameterMeters / 2, color);
    return { id, scaledDiameterMeters, tooLarge: false, requiredBaselineMeters: null };
  } catch {
    return { id: null, scaledDiameterMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }
}
