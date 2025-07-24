/* js/labelManager.js -------------------------------------------------- */
'use strict';

import { Vector, Entity, LonLat } from "../lib/og.es.js";

/* Шар для всіх підписів і лід-лайнів */
const labelLayer = new Vector("labelLayer", { visibility: true });

/* Переклад назви об’єкта */
export function translateName(key) {
  const lang = window.currentLang || 'ua';      // або інша глобальна змінна
  try {
    return locales[key] && locales[key][lang] ? locales[key][lang] : key;
  } catch (e) {
    return key;                                // резерв: показати оригінал
  }
}

export { labelLayer };

/* Підключаємо шар до існуючого глобуса */
export function initLabels(globe) {
  globe.planet.addLayer(labelLayer);
}


/* Очищаємо всі підписи (викликайте разом із clearCircles) */
export function clearLabels() {
  labelLayer.clear();
}

/* Внутрішня утиліта: LonLat → LonLat на відстані distanceMeters і азимуті bearingDeg */
function destination(lonlat, distanceMeters, bearingDeg) {
  const R = 6378137;                        // середній радіус Землі, м
  const δ = distanceMeters / R;             // кутова відстань
  const θ = bearingDeg * Math.PI / 180;

  const φ1 = lonlat.lat * Math.PI / 180;
  const λ1 = lonlat.lon * Math.PI / 180;

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) +
                Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);

  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );

  return new LonLat(λ2 * 180 / Math.PI, φ2 * 180 / Math.PI);
}

/**
 * Додає підпис до кола.
 *  options = {
 *    text        : 'сонце' | 'земля',
 *    textColor   : '#17a061' | '#1e5fff',
 *    circleRadius: <радіус кола, м>,
 *    centerLonLat: <LonLat центру>,
 *    bearingDeg  : <куди вивести підпис, 0-360°>   // необовʼязково, за замовч. 45
 *  }
 */
export function addLabel(options) {
  const bearing   = options.bearingDeg ?? 45;
  const edgeLL    = destination(options.centerLonLat, options.circleRadius, bearing);
  const anchorLL  = destination(options.centerLonLat, options.circleRadius * 1.001, bearing);

  /* Лід-лайн */

  /* Текст */
  labelLayer.add(new Entity({
    lonlat: anchorLL,
    label : {
      text        : options.text,
      size        : 12,
      color       : options.textColor,
      outlineSize : 20,
      outlineColor: 'rgba(255,255,255,0.85)'
    }
  }));

  /* Підкреслення (коротка лінія під словом) */
  const underlineEnd = destination(anchorLL, options.circleRadius * 0.1, bearing + 90);
  labelLayer.add(new Entity({
    polyline: {
      coordinates: [anchorLL, underlineEnd],
      width      : 2,
      color      : options.textColor,
      clampToGround: true
    }
  }));
}
/* кінець labelManager.js --------------------------------------------- */
