// full/js/calc/calculate_geo_objects.js
'use strict';

/**
 * Калькулятор для «Географія → Об’єкти (довжина/висота)».
 * Лінійна пропорція по РАДІУСУ:
 *   R2 = R1 * (L2 / L1), де R1 = D1/2
 *   ⇒ D2 = 2 * R2
 */

const EARTH_RADIUS_M = 6371008.8;
const LIM_RADIUS = Math.PI * EARTH_RADIUS_M;

let __idSeq = 1;

let __baseline = {
  valueReal: NaN,           // L1 (у метрах)
  unit: 'm',
  circleDiameterMeters: 0,  // D1
  color: undefined
};

export function setGeoObjectsBaseline({ valueReal, unit = 'm', circleDiameterMeters = 0, color } = {}) {
  const l1 = Number(valueReal);
  const d1 = Number(circleDiameterMeters);

  __baseline.valueReal = Number.isFinite(l1) && l1 > 0 ? l1 : NaN;
  __baseline.unit = unit || 'm';
  __baseline.circleDiameterMeters = Number.isFinite(d1) && d1 >= 0 ? d1 : 0;
  __baseline.color = color;

  return {};
}

export function addGeoObjectsCircle({ valueReal, unit = 'm', color } = {}) {
  const l2 = Number(valueReal);
  const l1 = __baseline.valueReal;
  const d1 = __baseline.circleDiameterMeters;

  if (!Number.isFinite(l2) || l2 <= 0 || !Number.isFinite(l1) || l1 <= 0 || d1 <= 0) {
    return { id: __idSeq++, scaledRadiusMeters: 0, tooLarge: false, requiredBaselineMeters: 0 };
  }

  // R2 = (D1/2) * (L2/L1)
  const r2 = (d1 / 2) * (l2 / l1);

  const tooLarge = r2 >= LIM_RADIUS;
  let requiredBaselineMeters = 0;
  if (tooLarge) {
    // (D1/2)*(L2/L1) < LIM  ⇒  D1 < 2*LIM*(L1/L2)
    requiredBaselineMeters = 2 * LIM_RADIUS * (l1 / l2);
  }

  return {
    id: __idSeq++,
    scaledRadiusMeters: r2,
    tooLarge,
    requiredBaselineMeters
  };
}

export function resetGeoObjectsScale() {
  __baseline = { valueReal: NaN, unit: 'm', circleDiameterMeters: 0, color: undefined };
}

export function getGeoObjectsScale() {
  // тут немає "масштабу площі", тож повертаємо корисну довідку про baseline
  return { baseline: __baseline };
}
