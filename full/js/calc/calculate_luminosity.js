// full/js/calc/calculate_luminosity.js
'use strict';

import { addGeodesicCircle } from '../globe/circles.js';

// Стан режиму "Світність"
let currentScale = null;          // S = Dmap(O1) / sqrt(Lreal(O1))
let __baselineId = null;
let __baselineL1 = null;          // світність О1 (в L☉)

// Константи сфери Землі
const R_EARTH = 6_371_000;           // м
const LIM_RADIUS = Math.PI * R_EARTH; // максимально допустимий радіус кола на мапі (антипод)
const EPS_M = 1;                      // м

// скидання масштабу при глобальному reset
window.addEventListener('orbit:ui-reset', () => {
  currentScale = null;
  __baselineId = null;
  __baselineL1 = null;
});

// База (О1): фіксуємо масштаб і, якщо можна, малюємо довідкове коло
export function setLuminosityBaseline(realL, realUnit, circleDiameterMeters, color = 'rgba(255,0,0,0.8)') {
  __baselineId = null;
  currentScale = null;
  __baselineL1 = null;

  const L1 = Number(realL);
  const Dm = Number(circleDiameterMeters);
  if (!isFinite(L1) || L1 <= 0 || !isFinite(Dm) || Dm <= 0) return null;

  const sqrtL1 = Math.sqrt(L1);
  currentScale = Dm / sqrtL1;
  __baselineL1 = L1;

  const r = Dm / 2;
  if (r > LIM_RADIUS + EPS_M) return null;

  try {
    __baselineId = addGeodesicCircle(r, color, __baselineId);
    return __baselineId;
  } catch {
    return null;
  }
}

// О2: масштабуємо діаметр за світністю, малюємо коло (або підказуємо межу)
export function addLuminosityCircle(realL2, realUnit, color = 'rgba(0,128,255,0.8)') {
  if (currentScale == null || !(currentScale > 0)) {
    return { id: null, scaledDiameterMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }
  const L2 = Number(realL2);
  if (!isFinite(L2) || L2 <= 0) {
    return { id: null, scaledDiameterMeters: null, tooLarge: false, requiredBaselineMeters: null };
  }

  const scaledDiameterMeters = currentScale * Math.sqrt(L2);

  // Перевірка межі (антипод)
  if ((scaledDiameterMeters / 2) > (LIM_RADIUS + EPS_M)) {
    let requiredBaselineMeters = null;
    if (isFinite(__baselineL1) && __baselineL1 > 0) {
      // Dmap1_req = (2πR) / sqrt(L2/L1) = (2πR) * sqrt(L1/L2)
      requiredBaselineMeters = (2 * Math.PI * R_EARTH) * Math.sqrt(__baselineL1 / L2);
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
