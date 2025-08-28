// full/js/calc/calculate_geo_population.js
'use strict';

/**
 * Калькулятор для «Географія → Населення».
 * Площа кола ∝ кількості населення:
 *   D2 = D1 * sqrt(N2 / N1)  ⇒  r2 = (D1/2) * sqrt(N2/N1)
 */

const EARTH_RADIUS_M = 6371008.8;
const LIM_RADIUS = Math.PI * EARTH_RADIUS_M;

let __idSeq = 1;

let __baseline = {
  valueReal: NaN,           // N1
  unit: 'people',
  circleDiameterMeters: 0,  // D1
  color: undefined
};

let __currentScaleArea = 0;

function circleAreaByD(d) {
  const D = Number(d);
  if (!Number.isFinite(D) || D <= 0) return 0;
  return Math.PI * (D * D) / 4;
}

export function setGeoPopulationBaseline({ valueReal, unit = 'people', circleDiameterMeters = 0, color } = {}) {
  const n1 = Number(valueReal);
  const d1 = Number(circleDiameterMeters);

  __baseline.valueReal = Number.isFinite(n1) && n1 > 0 ? n1 : NaN;
  __baseline.unit = unit || 'people';
  __baseline.circleDiameterMeters = Number.isFinite(d1) && d1 >= 0 ? d1 : 0;
  __baseline.color = color;

  const A1 = circleAreaByD(__baseline.circleDiameterMeters);
  __currentScaleArea = (Number.isFinite(n1) && n1 > 0 && A1 > 0) ? (A1 / n1) : 0;

  return { currentScaleArea: __currentScaleArea };
}

export function addGeoPopulationCircle({ valueReal, unit = 'people', color } = {}) {
  const n2 = Number(valueReal);
  const n1 = __baseline.valueReal;
  const d1 = __baseline.circleDiameterMeters;

  if (!Number.isFinite(n2) || n2 <= 0 || !Number.isFinite(n1) || n1 <= 0 || d1 <= 0) {
    return { id: __idSeq++, scaledRadiusMeters: 0, tooLarge: false, requiredBaselineMeters: 0 };
  }

  const r2 = (d1 / 2) * Math.sqrt(n2 / n1);

  const tooLarge = r2 >= LIM_RADIUS;
  let requiredBaselineMeters = 0;
  if (tooLarge) {
    requiredBaselineMeters = 2 * LIM_RADIUS * Math.sqrt(n1 / n2);
  }

  return {
    id: __idSeq++,
    scaledRadiusMeters: r2,
    tooLarge,
    requiredBaselineMeters
  };
}

export function resetGeoPopulationScale() {
  __baseline = { valueReal: NaN, unit: 'people', circleDiameterMeters: 0, color: undefined };
  __currentScaleArea = 0;
}

export function getGeoPopulationScale() {
  return __currentScaleArea;
}
