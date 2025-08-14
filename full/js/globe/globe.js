// globe.js

'use strict';

import { Globe, XYZ, Vector } from '../../lib/og.es.js';
import { initCamera } from "./camera.js";
import { initMarkers } from "./markers.js";

// Базовий шар OSM
const osm = new XYZ("OpenStreetMap", {
  isBaseLayer: true,
  url       : "//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  visibility: true
});

// Порожній шар для маркерів
export const markerLayer = new Vector("markerLayer");

// Координати за замовчуванням (Львів)
export const defaultCenterLat = 49.8419;
export const defaultCenterLon = 24.0315;

// Ініціалізація глобуса
export const globus = new Globe({
  target      : "globe-container",
  name        : "Earth",
  layers      : [osm, markerLayer],
  resourcesSrc: "./res",
  fontsSrc    : "./res/fonts",
  view: {
    lat    : defaultCenterLat,
    lon    : defaultCenterLon,
    range  : 10_000_000,
    tilt   : 0,
    heading: 0
  }
});
export const labelsLayer = new Vector("labelsLayer", { visibility: true });
globus.planet.addLayer(labelsLayer);

// Підключаємо модулі камери та маркерів
initCamera(globus);
initMarkers(globus);

