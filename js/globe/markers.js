// /js/globe/markers.js
'use strict';

import { globus, markerLayer } from "./globe.js";
import { LonLat, Entity } from '../../lib/og.es.js';
import { updateCameraView } from "./camera.js";

const STORAGE_LON_KEY = 'orbit:center.lon';
const STORAGE_LAT_KEY = 'orbit:center.lat';

let __lastCenter = { lon: null, lat: null };

// Той самий debug, що й у гіда: ?guide_debug=1
function isGuideDebugMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('guide_debug') === '1';
  } catch {
    return false;
  }
}

function saveCenterToStorage(lon, lat) {
  if (isGuideDebugMode()) return; // у debug нічого не зберігаємо
  try {
    window.localStorage.setItem(STORAGE_LON_KEY, String(lon));
    window.localStorage.setItem(STORAGE_LAT_KEY, String(lat));
  } catch {
    // localStorage може бути недоступний — мовчки ігноруємо
  }
}

/**
 * Відновити маркер з localStorage, якщо координати вже були збережені.
 * Використовуємо тихий режим: без руху камери і без подій.
 */
export function restoreMarkerFromStorage() {
  if (isGuideDebugMode()) return; // у debug завжди стартуємо «з нуля»

  let lonStr, latStr;
  try {
    lonStr = window.localStorage.getItem(STORAGE_LON_KEY);
    latStr = window.localStorage.getItem(STORAGE_LAT_KEY);
  } catch {
    return;
  }

  if (lonStr == null || latStr == null) return;

  const lon = parseFloat(lonStr);
  const lat = parseFloat(latStr);

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return;

  // Ставимо маркер тихо: без подій і без повторного запису в storage
  placeMarker(lon, lat, {
    silent: true,
    suppressEvent: true,
    skipStore: true
  });
}

/** Публічна функція для встановлення/перенесення маркера */
export function placeMarker(
  lon,
  lat,
  { silent = false, suppressEvent = false, skipStore = false } = {}
) {
  markerLayer.clear();

  const newMarker = new Entity({
    name   : 'Marker',
    lonlat : new LonLat(lon, lat),
    billboard: {
      src    : './res/marker.png',
      size   : [16, 24],
      offset : [0, 12]
    }
  });

  markerLayer.add(newMarker);

  const same = (__lastCenter.lon === lon && __lastCenter.lat === lat);
  __lastCenter = { lon, lat };

  // Зберігаємо центр у localStorage (крім debug або спеціального виклику зі skipStore)
  if (!skipStore) {
    saveCenterToStorage(lon, lat);
  }

  // повідомляємо, що центр змінився (один раз і лише якщо координати реально нові)
  if (!suppressEvent && !same) {
    window.dispatchEvent(new CustomEvent('orbit:center-changed', {
      detail: { lon, lat }
    }));
  }

  // Камеру рухаємо лише якщо не silent
  if (!silent) {
    updateCameraView(globus, { type: 'markerMoved' });
  }
}

/** Вішає обробник кліку по глобусу для встановлення маркера */
export function initMarkers(globus) {
  const ev = globus.planet?.renderer?.events;
  if (!ev) {
    console.warn('[markers.js] Події кліку недоступні.');
    return;
  }

  ev.on('lclick', e => {
    const pixel = { x: e.x, y: e.y };
    const lonLat = globus.planet.getLonLatFromPixelTerrain(pixel);
    if (!lonLat) return;

    placeMarker(lonLat.lon, lonLat.lat);
  });
}
