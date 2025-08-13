// full/js/globe/markers.js
'use strict';

import { globus, markerLayer } from "./globe.js";
import { LonLat, Entity } from '../../lib/og.es.js';
import { updateCameraView } from "./camera.js";

/** Публічна функція для встановлення/перенесення маркера */
export function placeMarker(lon, lat, { silent = false, suppressEvent = false } = {}) {

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
  // повідомляємо, що центр змінився (крім випадків, коли приглушено)
  if (!suppressEvent) {
    window.dispatchEvent(new CustomEvent('orbit:center-changed', {
      detail: { lon, lat }
    }));
  }


  // 🔔 повідомляємо всім модулям (колам тощо), що центр змінився
  window.dispatchEvent(new CustomEvent('orbit:center-changed', {
    detail: { lon, lat }
  }));

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

