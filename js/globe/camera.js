// camera.js

'use strict';

import { markerLayer, defaultCenterLat, defaultCenterLon } from "./globe.js";
import { LonLat } from '../../lib/og.es.js';

export function initCamera(globus) {
  const cam = globus.planet ? globus.planet.camera : globus.camera;
  if (cam) {
    cam.maxAltitude = 50_000_000;
    cam.update();
    const threeCam = cam.camera;
    if (threeCam) { 
      threeCam.far = 200_000_000; 
      threeCam.updateProjectionMatrix(); 
    }
    
    setTimeout(() => {
      updateCameraView(globus, { type: 'initial' });
    }, 100);
  } else {
    console.warn('[camera.js] Камера не знайдена.');
  }
}

export function updateCameraView(globus, context) {
  const cam = globus.planet.camera;
  const entities = markerLayer.getEntities();
  const centerLL = entities.length
    ? entities.slice(-1)[0].getLonLat()
    : new LonLat(defaultCenterLon, defaultCenterLat);

  switch (context.type) {
    case 'initial':
      cam._numFrames = 180;
      cam.flyLonLat(new LonLat(centerLL.lon, centerLL.lat, 3_000_000));
      break;

    case 'markerMoved':
      break;

    default:
      console.warn('[camera.js] Невідомий тип контексту:', context.type);
  }
}

export function getCameraAPI(globus) {
  const cam = globus?.planet?.camera;
  const ellipsoid = globus?.planet?.ellipsoid;
  if (!cam || !ellipsoid) {
    console.error('[camera.js] Planet camera / ellipsoid not available');
    return null;
  }

  const R = 6_371_008.8;
  const DEG = Math.PI / 180;

  const normLon = (lon) => {
    let L = lon; 
    while (L < -180) L += 360; 
    while (L >= 180) L -= 360; 
    return L;
  };

  const getFov = () => {
    const threeCam = cam.camera;
    return (threeCam && typeof threeCam.fov === 'number') ? threeCam.fov : 45;
  };

  const estimateAlt = (radiusM, fovDeg) => {
    const delta = Math.max(0, Math.min(Math.PI, radiusM / R));
    const eff = Math.min(delta, Math.PI - delta);
    const fovR = Math.max(15*DEG, Math.min(90*DEG, fovDeg*DEG));
    const k = 1.15;
    const h = (k * R * eff) / Math.tan(fovR / 2);
    const MIN = 10, MAX = 30_000_000;
    return Math.min(Math.max(h, MIN), MAX);
  };

  const getSceneCenterLL = () => {
    try {
      const entities = markerLayer.getEntities();
      if (entities && entities.length) {
        const ll = entities[entities.length - 1].getLonLat();
        return new LonLat(ll.lon, ll.lat);
      }
    } catch (e) {
      console.warn('[camera.js] Помилка отримання центру:', e);
    }
    return new LonLat(defaultCenterLon, defaultCenterLat);
  };

  const angularDistanceDeg = (a, b) => {
    const φ1 = a.lat * DEG, φ2 = b.lat * DEG;
    const λ1 = a.lon * DEG, λ2 = b.lon * DEG;
    const s = Math.acos(Math.min(1, Math.max(-1,
      Math.sin(φ1)*Math.sin(φ2) + Math.cos(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1)
    )));
    return s * (180 / Math.PI);
  };

  const ensureFarAndStop = () => {
    try {
      const threeCam = cam.camera;
      if (threeCam && (threeCam.far || 0) < 200_000_000) {
        threeCam.far = 200_000_000; 
        threeCam.updateProjectionMatrix();
      }
      if (typeof cam.stopFlying === 'function') cam.stopFlying();
    } catch (e) {
      console.warn('[camera.js] Помилка ensureFarAndStop:', e);
    }
  };

  const getCurrentHeight = () => {
    try {
      return (typeof cam.getHeight === 'function') ? cam.getHeight() :
             (typeof cam.getAltitude === 'function') ? cam.getAltitude() : 1_000_000;
    } catch (e) {
      return 1_000_000;
    }
  };

  let flightToken = 0;

  // Функція для ease-out анімації
  const smoothFlyToWithEaseOut = (token, targetLL, targetHeight, durationMs) => {
    if (token !== flightToken) return;
    
    ensureFarAndStop();
    
    // Збільшуємо кількість кадрів для більшої плавності
    const totalFrames = Math.max(60, Math.floor(durationMs / 16));
    
    // Використовуємо вбудвану анімацію OpenGlobus
    cam._numFrames = totalFrames;
    cam.flyLonLat(new LonLat(targetLL.lon, targetLL.lat, targetHeight));
  };

  // Двосхідна анімація: швидкий підхід + повільне точне наведення
  const twoPhaseFlyTo = (token, targetLL, targetHeight, durationMs) => {
    if (token !== flightToken) return;
    
    ensureFarAndStop();
    
    const totalDuration = durationMs;
    const approachDuration = totalDuration * 0.6; // 60% часу - швидкий підхід
    const fineTuneDuration = totalDuration * 0.4; // 40% часу - точне наведення
    
    // Перша фаза: швидкий підхід
    cam._numFrames = Math.max(30, Math.floor(approachDuration / 16));
    cam.flyLonLat(new LonLat(targetLL.lon, targetLL.lat, targetHeight * 1.05)); // Трохи вище цілі
    
    // Друга фаза: повільне точне наведення
    setTimeout(() => {
      if (token !== flightToken) return;
      
      ensureFarAndStop();
      cam._numFrames = Math.max(40, Math.floor(fineTuneDuration / 16)); // Більше кадрів для плавності
      cam.flyLonLat(new LonLat(targetLL.lon, targetLL.lat, targetHeight));
    }, approachDuration + 50);
  };

  // Плавна анімація з ручним контролем через requestAnimationFrame
  const manualSmoothFlyTo = (token, startLL, startHeight, targetLL, targetHeight, durationMs) => {
    if (token !== flightToken) return;
    
    ensureFarAndStop();
    
    const startTime = performance.now();
    const duration = durationMs;
    
    const animate = (currentTime) => {
      if (token !== flightToken) return;
      
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out функція: сповільнення в кінці
      const easeOutProgress = 1 - Math.pow(1 - progress, 1.5);
      
      // Інтерполяція положення та висоти
      const currentLon = startLL.lon + (targetLL.lon - startLL.lon) * easeOutProgress;
      const currentLat = startLL.lat + (targetLL.lat - startLL.lat) * easeOutProgress;
      const currentHeight = startHeight + (targetHeight - startHeight) * easeOutProgress;
      
      // Миттєве оновлення положення камери
      cam._numFrames = 1;
      cam.flyLonLat(new LonLat(currentLon, currentLat, currentHeight));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Фінальна точна установка
        cam._numFrames = 1;
        cam.flyLonLat(new LonLat(targetLL.lon, targetLL.lat, targetHeight));
      }
    };
    
    requestAnimationFrame(animate);
  };

  return {
    getFovDeg() { 
      try {
        return getFov();
      } catch (e) {
        return 45;
      }
    },

    flyToNadir({ lon, lat, radiusM, altitudeM, durationMs = 2500 }) { // Збільшили тривалість
      if (!cam) {
        console.error('[camera.js] Камера не доступна');
        return;
      }

      flightToken++;
      const token = flightToken;

      const fov = this.getFovDeg();
      const finalH = (typeof altitudeM === 'number' && altitudeM > 0)
        ? altitudeM
        : (typeof radiusM === 'number' && radiusM > 0)
          ? estimateAlt(radiusM, fov)
          : 1_000_000;

      const targetLL = new LonLat(normLon(lon), lat);
      const startLL = getSceneCenterLL();
      const startH = getCurrentHeight();

      const ang = angularDistanceDeg(startLL, targetLL);
      
      // Адаптуємо тривалість залежно від відстані
      let adaptedDuration = durationMs;
      if (ang > 90) {
        adaptedDuration = durationMs * 1.8;
      } else if (ang > 45) {
        adaptedDuration = durationMs * 1.3;
      }
      
      // Для коротких відстаней використовуємо просту анімацію з ease-out
      if (ang < 30) {
        smoothFlyToWithEaseOut(token, targetLL, finalH, adaptedDuration);
      } 
      // Для середніх відстаней - двосхідну анімацію
      else if (ang < 120) {
        twoPhaseFlyTo(token, targetLL, finalH, adaptedDuration);
      }
      // Для дуже довгих відстаней - ручну анімацію з повним контролем
      else {
        manualSmoothFlyTo(token, startLL, startH, targetLL, finalH, adaptedDuration);
      }
    }
  };
}

export function updateAltimeterReadout(globus) {
  const el = document.getElementById('altimeter');
  if (!el) return;

  const cam = globus?.planet?.camera;
  if (!cam) return;

  try {
    const h = (typeof cam.getHeight === 'function') ? cam.getHeight() :
              (typeof cam.getAltitude === 'function') ? cam.getAltitude() : 0;

    const fmt = (m) => {
      const s = Math.round(m).toString();
      return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };

    el.textContent = `${fmt(h)} m`;
  } catch (e) {
    console.warn('[camera.js] Помилка оновлення альтиметра:', e);
  }
}