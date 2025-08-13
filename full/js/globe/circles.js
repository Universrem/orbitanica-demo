// full/js/globe/circles.js
'use strict';

import { markerLayer, globus, defaultCenterLat, defaultCenterLon } from "./globe.js";
import { Entity, Vector } from '../../lib/og.es.js';
import { placeMarker } from "./markers.js";

// Шар для всіх геодезичних кіл
export const circlesLayer = new Vector("circlesLayer", { visibility: true });
globus.planet.addLayer(circlesLayer);

// === МОДЕЛЬ НАМАЛЬОВАНИХ КІЛ (для перевимальовування при зміні центра) ===
const __circlesModel = []; // елементи { radiusMeters:number, color:string }

// Актуальний центр: з маркера; якщо маркера немає — ставимо у Львів (без руху камери)
function __getCurrentCenter() {
  const entities = markerLayer.getEntities();
  if (entities.length) {
    const ll = entities[entities.length - 1].getLonLat();
    return { lon: ll.lon, lat: ll.lat };
  }
  // Ставимо маркер у Львові без руху камери й повертаємо цей центр
  placeMarker(defaultCenterLon, defaultCenterLat, { silent: true, suppressEvent: true });
  return { lon: defaultCenterLon, lat: defaultCenterLat };
}

/**
 * Обчислює точки геодезичного кола на сфері (апроксимація для невеликих радіусів).
 */
function getCirclePointsSphere(lon, lat, radiusMeters, segments = 64) {
  const coords = [];
  const R = 6371000;

  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);

    const newLat = latRad + (dy / R);
    const newLon = lonRad + (dx / (R * Math.cos(latRad)));

    coords.push([newLon * 180 / Math.PI, newLat * 180 / Math.PI]);
  }
  return coords;
}

/**
 * Додає геодезичне коло навколо поточного маркера.
 * _isRedraw — внутрішній прапорець, щоб не дублювати запис у модель при перевимальовуванні.
 */
export function addGeodesicCircle(radiusMeters, color = 'rgba(255,0,0,0.8)', _isRedraw = false) {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return;

  // Зберігаємо в модель тільки при «звичайному» додаванні
  if (!_isRedraw) {
    __circlesModel.push({ radiusMeters, color });
  }

  const { lon, lat } = __getCurrentCenter();
  const coords = getCirclePointsSphere(lon, lat, radiusMeters);

  const haloEntity = new Entity({
  geometry: {
    type: "LineString",
    coordinates: coords,
    style: {
      lineColor: "rgba(0,0,0,0.35)", // темно-сіра напівпрозора «тінь»
      lineWidth: 7                   // трохи ширше за основну лінію
    }
  }
});
circlesLayer.add(haloEntity);        // ДОДАЄМО ТІНЬ ПЕРШОЮ (внизу)

const circleEntity = new Entity({
  geometry: {
    type: "LineString",
    coordinates: coords,
    style: {
      lineColor: color,              // ваш індивідуальний колір
      lineWidth: 5
    }
  }
});
circlesLayer.add(circleEntity);      // ОСНОВНЕ КОЛО ЗВЕРХУ
}

// Перемалювати всі кола під новий центр
function __redrawAllCircles() {
  try { circlesLayer.clear(); } catch (e) {}
  // Перебудовуємо кожне коло навколо поточного маркера
  __circlesModel.forEach(c => {
    try { addGeodesicCircle(c.radiusMeters, c.color, /* _isRedraw */ true); }
    catch (e) { console.error('[circles redraw] failed:', e); }
  });
}

// Події
// Центр змінено (маркер пересунули) → перевимальовуємо всі кола
window.addEventListener('orbit:center-changed', __redrawAllCircles);

// Глобальний reset UI → чистимо модель (шар очищається в reset.js)
window.addEventListener('orbit:ui-reset', () => {
  __circlesModel.length = 0;
});



