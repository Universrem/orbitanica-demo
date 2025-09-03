//js/globe/globe.js
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

// Шар підписів/крапок
export const labelsLayer = new Vector("labelsLayer", { visibility: true });
globus.planet.addLayer(labelsLayer);

// ───────────────────────────────────────────────────────────────
// Захист від сторонніх очищень/видалень шарів під час «Старт»
(function patchPlanetAndLayers() {
  try {
    const planet = globus.planet;

    // Глобальний прапор «жорсткого» ресету — не відновлюємо під час resetAllUI
    if (typeof window.__orbitHardReset !== 'boolean') window.__orbitHardReset = false;
    window.addEventListener('orbit:ui-reset', () => {
      window.__orbitHardReset = true;
      setTimeout(() => { window.__orbitHardReset = false; }, 0);
    });

    const safeReadd = () => {
      try { planet.addLayer(labelsLayer); } catch {}
      try { window.dispatchEvent(new CustomEvent('orbit:screen-partial-cleared')); } catch {}
    };

    // Перехопити removeLayer(…)
    if (planet && typeof planet.removeLayer === 'function' && !planet.__patchedRemoveLayer) {
      const origRemoveLayer = planet.removeLayer.bind(planet);
      planet.removeLayer = function(layer) {
        const out = origRemoveLayer(layer);
        try {
          if (!window.__orbitHardReset && layer === labelsLayer) {
            requestAnimationFrame(safeReadd);
          }
        } catch { safeReadd(); }
        return out;
      };
      planet.__patchedRemoveLayer = true;
    }

    // Перехопити clearLayers()
    if (planet && typeof planet.clearLayers === 'function' && !planet.__patchedClearLayers) {
      const origClearLayers = planet.clearLayers.bind(planet);
      planet.clearLayers = function(...args) {
        const out = origClearLayers(...args);
        try {
          if (!window.__orbitHardReset) requestAnimationFrame(safeReadd);
        } catch { safeReadd(); }
        return out;
      };
      planet.__patchedClearLayers = true;
    }

    // Додатково: якщо labelsLayer раптом зник — повернути його при частковому очищенні
    window.addEventListener('orbit:screen-partial-cleared', () => {
      try { planet.addLayer(labelsLayer); } catch {}
    });
  } catch {}
})();

// Підключаємо модулі камери та маркерів
initCamera(globus);
initMarkers(globus);
