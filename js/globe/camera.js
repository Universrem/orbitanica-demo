// camera.js

'use strict';

import { markerLayer, defaultCenterLat, defaultCenterLon } from "./globe.js";
import { LonLat } from '../../lib/og.es.js';

/** Налаштовує камеру та робить початковий рух */
export function initCamera(globus) {
  const cam = globus.planet ? globus.planet.camera : globus.camera;
  if (cam) {
    cam.maxAltitude = 50_000_000;
    cam.update();
    const threeCam = cam.camera;
    if (threeCam) { threeCam.far = 5_000_000; threeCam.updateProjectionMatrix(); }
  } else {
    console.warn('[camera.js] Камера не знайдена.');
  }
  updateCameraView(globus, { type: 'initial' });
}

/** Оновлення вигляду камери залежно від контексту */
export function updateCameraView(globus, context) {
  const cam = globus.planet.camera;
  const ellipsoid = globus.planet.ellipsoid;

  // Визначаємо центр: останній маркер або Львів
  const entities = markerLayer.getEntities();
  const centerLL = entities.length
    ? entities.slice(-1)[0].getLonLat()
    : new LonLat(defaultCenterLon, defaultCenterLat);
  const centerCart = ellipsoid.lonLatToCartesian(centerLL);

  switch (context.type) {
    case 'initial':
      cam._numFrames = 120;
      cam.flyDistance(centerCart, 3_000_000);
      break;

    case 'markerMoved':
      // без руху камери
      break;

    default:
      console.warn('[camera.js] Невідомий тип контексту:', context.type);
  }
}
