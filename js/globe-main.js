'use strict';

import { Globe, LonLat, Vector, Entity, XYZ } from "../lib/og.es.js";

// --- Центр глобуса: Львів
const centerLatDeg = 49.8419;
const centerLonDeg = 24.0315;

// --- Базовий шар
const osm = new XYZ("OpenStreetMap", {
  isBaseLayer: true,
  url        : "//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  visibility : true
});

// --- Початкова мітка
const markerEntity = new Entity({
  name     : "Львів",
  lonlat   : new LonLat(centerLonDeg, centerLatDeg),
  billboard: { src: "./res/marker.png", size: [16, 24], offset: [0, 12] }
});
export const markerLayer = new Vector("markerLayer", { entities: [markerEntity] });

// --- Глобус
export const globus = new Globe({
  target      : "globus",
  name        : "Earth",
  layers      : [osm, markerLayer],
  resourcesSrc: "./res",
  fontsSrc    : "./res/fonts",
  view        : { lat: centerLatDeg, lon: centerLonDeg, range: 10_000_000, tilt: 0, heading: 0 }
});

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
{
  const ell = globus.planet.ellipsoid;
  const startCart = ell.lonLatToCartesian(markerEntity.getLonLat());
  cam.flyDistance(startCart, zoomDistance);
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
  const centerLL = markerLayer.getEntities().slice(-1)[0].getLonLat();
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

  const centerLL = markerLayer.getEntities().slice(-1)[0].getLonLat();
  addEdgeMarker(centerLL, r1_m,  45, marker1);
  addEdgeMarker(centerLL, r2_m, -45, marker2);
}

// --- Три кола
export function drawThreeCircles(r1_m, r2_m, r3_m, marker1, marker2, marker3) {
  lastRadius1 = r1_m; lastRadius2 = r2_m; lastRadius3 = r3_m;
  lastSrc1 = marker1; lastSrc2 = marker2; lastSrc3 = marker3;

  ensureCircleLayer(); circleLayer.clear(); clearEdgeMarkers();
  addCircle(true, r1_m, defaultColors[0]);
  addCircle(true, r2_m, defaultColors[1]);
  addCircle(true, r3_m, defaultColors[2]);

  const centerLL = markerLayer.getEntities().slice(-1)[0].getLonLat();
  addEdgeMarker(centerLL, r1_m,   135, marker1);
  addEdgeMarker(centerLL, r2_m,  -45, marker2);
  addEdgeMarker(centerLL, r3_m,  135, marker3);
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

    const ell = globus.planet.ellipsoid;
    const cart = ell.lonLatToCartesian(newMarker.getLonLat());
    cam.flyDistance(cart, zoomDistance);

    if (lastRadius3 !== null) {
      drawThreeCircles(lastRadius1, lastRadius2, lastRadius3, lastSrc1, lastSrc2, lastSrc3);
    } else if (lastRadius1 !== null && lastRadius2 !== null) {
      drawTwoCircles(lastRadius1, lastRadius2, lastSrc1, lastSrc2);
    }
  });
} else {
  console.warn('[globe-main.js] Події кліку недоступні.');
}












