// /js/globe/camera_math.js
'use strict';

// Єдина формула оцінки висоти камери під радіус кола на сфері.
export function estimateAltitudeM(radiusM, fovDeg = 45, planetRadiusM = 6_371_008.8) {
  if (!radiusM || radiusM <= 0) return 1500;
  const fov = Math.max(15, Math.min(75, fovDeg)) * Math.PI / 180;
  const delta = radiusM / planetRadiusM;              // радіани
  const deltaEff = Math.min(delta, Math.PI - delta);  // не більше півсфери
  const k = 1.15;                                     // невеликий запас
  const h = planetRadiusM * (k * deltaEff) / Math.tan(fov / 2);
  return Math.max(50, Math.min(h, 15_000_000));
}
