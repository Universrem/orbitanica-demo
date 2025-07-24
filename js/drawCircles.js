// js/drawCircles.js
// Малювання двох кіл (діаметр/відстань) навколо динамічного центру

import { globus, markerLayer } from './globe-main.js';
import { Vector, Polyline } from '../lib/og.es.js';

const CIRCLE_LAYER_ID = 'orbitanica-circles';        // єдиний шар для кіл
const EARTH_RADIUS = 6_371_000;                       // середній радіус Землі, м

/*─────────────────────── службові ───────────────────────*/

/** Видаляє попередній шар кіл, якщо він існує */
function clearCircles() {
    const old = globus.planet.getLayerByName(CIRCLE_LAYER_ID);
  if (old) {
    globus.planet.removeLayer(old);
  }

}

/** Обчислює масив lon,lat-рядків точок кола навколо center */
function buildCirclePoints({ lon, lat }, radiusM, segments = 128) {
  const pts = [];
  const lat0 = lat * Math.PI / 180;
  const lon0 = lon * Math.PI / 180;
  const d = radiusM / EARTH_RADIUS;

  for (let i = 0; i <= segments; i++) {
    const θ = (i / segments) * 2 * Math.PI;
    const φ = Math.asin(Math.sin(lat0) * Math.cos(d) +
                        Math.cos(lat0) * Math.sin(d) * Math.cos(θ));
    const λ = lon0 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(lat0),
                                Math.cos(d) - Math.sin(lat0) * Math.sin(φ));
    pts.push(`${λ * 180 / Math.PI},${φ * 180 / Math.PI}`);
  }
  return pts;
}

/** Повертає центр (lon, lat) із першої мітки у markerLayer */
function getCenter() {
  const list = typeof markerLayer.getEntities === 'function'
    ? markerLayer.getEntities()
    : (markerLayer.entities || []);
  if (!list.length) return { lon: 0, lat: 0 };

  const m = list[0];
  if (typeof m.getLonLat === 'function') {
    const { lon, lat } = m.getLonLat();
    return { lon, lat };
  }
  if (m.lonlat) return { lon: m.lonlat.lon, lat: m.lonlat.lat };
  return { lon: 0, lat: 0 };
}

/** Додає новий вектор-шар із заданими polyline-об’єктами */
function addCircleLayer(entities) {
  const layer = new Vector(CIRCLE_LAYER_ID, { entities });
  globus.planet.addLayer(layer);
}

/*─────────────────────── публічні API ───────────────────────*/

/** Малює два кола за діаметрами (кілометри) */
export function drawDiameterCircles(d1_km, d2_km) {
  clearCircles();
  const center = getCenter();
  const r1 = (d1_km * 1000) / 2;
  const r2 = (d2_km * 1000) / 2;

  addCircleLayer([
    new Polyline({ positions: buildCirclePoints(center, r1), color: '#0000FF', thickness: 2 }),
    new Polyline({ positions: buildCirclePoints(center, r2), color: '#00FF00', thickness: 2 })
  ]);
}

/** Малює два кола за відстанями (кілометри) */
export function drawDistanceCircles(dist1_km, dist2_km) {
  clearCircles();
  const center = getCenter();
  const r1 = dist1_km * 1000;
  const r2 = dist2_km * 1000;

  addCircleLayer([
    new Polyline({ positions: buildCirclePoints(center, r1), color: '#FF00FF', thickness: 2 }),
    new Polyline({ positions: buildCirclePoints(center, r2), color: '#FFA500', thickness: 2 })
  ]);
}

