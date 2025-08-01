'use strict';

import { Globe, LonLat, Vector, Entity, XYZ, Vec3 } from "../lib/og.es.js";

// --- Базовий шар
const osm = new XYZ("OpenStreetMap", {
  isBaseLayer: true,
  url        : "//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  visibility : true
});

// Порожній шар: мітки з’являтимуться лише після дії користувача
export const markerLayer = new Vector("markerLayer");

// Координати «за замовчуванням» (Львів) – знадобляться sidebar
export const defaultCenterLat = 49.8419;
export const defaultCenterLon = 24.0315;

/** Повертає LonLat останньої мітки,
 *  або Львів, якщо мітки ще нема */
export function getCurrentCenterLL() {
  if (markerLayer.getEntities().length) {
    return markerLayer.getEntities().slice(-1)[0].getLonLat();
  }
  return new LonLat(defaultCenterLon, defaultCenterLat);
}

// --- Глобус
export const globus = new Globe({
  target      : "globus",
  name        : "Earth",
  layers      : [osm, markerLayer],
  resourcesSrc: "./res",
  fontsSrc    : "./res/fonts",
  view: {               // було lat: centerLatDeg …
  lat: defaultCenterLat,
  lon: defaultCenterLon,
  range: 10_000_000,
  tilt: 0,
  heading: 0
}

});
updateCameraView({ type: 'initial' });

// --- Камера
const zoomDistance = 3_000_000;
const cam = globus.planet ? globus.planet.camera : globus.camera;
if (cam) {
  cam.maxAltitude = 50_000_000;
  cam.update();
  const threeCam = cam.camera;
  if (threeCam) { threeCam.far = 5_000_000; threeCam.updateProjectionMatrix(); }
} else {
  console.warn('[globe-main.js] Камера не знайдена.');
}


// --- Стан
let circleLayer = null;
let edgeLayer   = null;
let lastRadius1 = null, lastRadius2 = null, lastRadius3 = null;
let lastSrc1    = null, lastSrc2    = null, lastSrc3    = null;

const defaultColors = [ [1,0,0,0.8], [1,1,0,0.8], [0,0,1,0.8] ];

function ensureCircleLayer() {
  if (!circleLayer) {
    circleLayer = new Vector('orbitanica-circles');
    globus.planet.addLayer(circleLayer);
  }
}
function ensureEdgeLayer() {
  if (!edgeLayer) {
    edgeLayer = new Vector('edgeMarkers');
    globus.planet.addLayer(edgeLayer);
  }
}
function clearEdgeMarkers() {
  if (edgeLayer) edgeLayer.clear();
}

// --- Коло
function getCirclePointsSphere(lon, lat, radiusMeters, segments = 128) {
  const φ1 = lat * Math.PI / 180;
  const λ1 = lon * Math.PI / 180;
  const R  = 6_371_000;
  const d  = radiusMeters / R;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const θ  = 2 * Math.PI * i / segments;
    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(d) +
      Math.cos(φ1) * Math.sin(d) * Math.cos(θ)
    );
    const λ2 = λ1 + Math.atan2(
      Math.sin(θ) * Math.sin(d) * Math.cos(φ1),
      Math.cos(d) - Math.sin(φ1) * Math.sin(φ2)
    );
    pts.push([λ2 * 180 / Math.PI, φ2 * 180 / Math.PI]);
  }
  return pts;
}

// --- Малює коло
function addCircle(isGeodesic, radiusMeters, color) {
  if (!isGeodesic) return;
  ensureCircleLayer();
  const centerLL = markerLayer.getEntities().length
  ? markerLayer.getEntities().slice(-1)[0].getLonLat()
  : new LonLat(defaultCenterLon, defaultCenterLat);
  const coords = getCirclePointsSphere(centerLL.lon, centerLL.lat, radiusMeters);
  const ent = new Entity({
    geometry: { type: 'LineString', coordinates: coords, clampToGround: true },
    style:    { strokeColor: '#ff0000', strokeWidth: 8 }
  });
  circleLayer.add(ent);
}

// --- Витягує назву з шляху до картинки
function getLabelFromMarker(marker) {
  if (!marker || typeof marker.src !== 'string') return 'Обʼєкт';
  const name = marker.src.split('/').pop().split('.')[0]; // 'marker', 'first'
  return name.replace(/[_-]/g, ' ').trim();               // → 'marker' → 'marker'
}

// --- Додає напис замість мітки
function addEdgeMarker(centerLL, r_m, bearingDeg, marker) {
  const ll = (function(ll, d, br) {
    const R=6378137, δ=d/R, θ=br*Math.PI/180;
    const φ1=ll.lat*Math.PI/180, λ1=ll.lon*Math.PI/180;
    const φ2=Math.asin(Math.sin(φ1)*Math.cos(δ)+Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
    const λ2=λ1+Math.atan2(
      Math.sin(θ)*Math.sin(δ)*Math.cos(φ1),
      Math.cos(δ)-Math.sin(φ1)*Math.sin(φ2)
    );
    return new LonLat(λ2*180/Math.PI, φ2*180/Math.PI);
  })(centerLL, r_m, bearingDeg);

  const label = getLabelFromMarker(marker);

  ensureEdgeLayer();
  edgeLayer.add(new Entity({
    lonlat: ll,
    label: {
        text       : label,
        size       : 16,
        color      : 'black',
        outline    : 0,
        offset     : [0, 40],
        visibility : true
      }

  }));
}

// --- Два кола
export function drawTwoCircles(r1_m, r2_m, marker1, marker2) {
  lastRadius1 = r1_m; lastRadius2 = r2_m; lastRadius3 = null;
  lastSrc1 = marker1; lastSrc2 = marker2; lastSrc3 = null;

  ensureCircleLayer(); circleLayer.clear(); clearEdgeMarkers();
  addCircle(true, r1_m, defaultColors[0]);
  addCircle(true, r2_m, defaultColors[1]);

  const centerLL = getCurrentCenterLL();
  addEdgeMarker(centerLL, r1_m,  45, marker1);
  addEdgeMarker(centerLL, r2_m, -45, marker2);

  updateCameraView({ type: 'drawTwo', radii: [r1_m, r2_m] });

}

// --- Три кола
export function drawThreeCircles(r1_m, r2_m, r3_m, marker1, marker2, marker3) {
  lastRadius1 = r1_m; lastRadius2 = r2_m; lastRadius3 = r3_m;
  lastSrc1 = marker1; lastSrc2 = marker2; lastSrc3 = marker3;

  ensureCircleLayer(); circleLayer.clear(); clearEdgeMarkers();
  addCircle(true, r1_m, defaultColors[0]);
  addCircle(true, r2_m, defaultColors[1]);
  addCircle(true, r3_m, defaultColors[2]);

  const centerLL = getCurrentCenterLL();

  addEdgeMarker(centerLL, r1_m,   135, marker1);
  addEdgeMarker(centerLL, r2_m,  -45, marker2);
  addEdgeMarker(centerLL, r3_m,  135, marker3);

  updateCameraView({ type: 'drawThree', radii: [r1_m, r2_m, r3_m] });

}

function updateCameraView(context) {
  const cam = globus.planet.camera;
  const ellipsoid = globus.planet.ellipsoid;
  
  const centerLL = getCurrentCenterLL();

  const centerCart = ellipsoid.lonLatToCartesian(centerLL);

  switch (context?.type) {
    case 'initial':
      cam._numFrames = 120; // 2–3 секунди
      cam.flyDistance(centerCart, 3_000_000);
      break;

    case 'drawTwo':
case 'drawThree': {
  const radii = context.radii || [];
  const maxR = Math.max(...radii);

  // FOV і aspect беремо правильно
  const canvas = globus.planet.renderer.handler.canvas;
  const aspect = canvas.width / canvas.height;
  const vFov = cam._viewAngle * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const minFov = Math.min(vFov, hFov);
  const margin = 1.2;
  const R = maxR * margin;
  const distance = R / Math.sin(minFov / 2);

    cam._numFrames = 120;
    cam.flyDistance(centerCart, distance);


  break;
}

    case 'markerMoved':
      // Не рухаємо камеру
      break;

    default:
      console.warn('[globe-main] Невідомий тип контексту для updateCameraView');
  }
}

// --- Клік по глобусу
if (globus.planet && globus.planet.renderer && globus.planet.renderer.events) {
  globus.planet.renderer.events.on('lclick', e => {
    const pixel = { x: e.x, y: e.y };
    const lonLat = globus.planet.getLonLatFromPixelTerrain(pixel);
    if (!lonLat) return;

    markerLayer.clear();
    const newMarker = new Entity({
      name: 'Marker',
      lonlat: new LonLat(lonLat.lon, lonLat.lat),
      billboard: { src: './res/marker.png', size: [16,24], offset: [0,12] }
    });
    markerLayer.add(newMarker);

    updateCameraView({ type: 'markerMoved' });

    if (lastRadius3 !== null) {
      drawThreeCircles(lastRadius1, lastRadius2, lastRadius3, lastSrc1, lastSrc2, lastSrc3);
    } else if (lastRadius1 !== null && lastRadius2 !== null) {
      drawTwoCircles(lastRadius1, lastRadius2, lastSrc1, lastSrc2);
    }
  });
} else {
  console.warn('[globe-main.js] Події кліку недоступні.');
}












