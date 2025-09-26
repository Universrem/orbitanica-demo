// /js/globe/camera.js
// Єдина точка керування камерою. Без костилів.
// Крок 1: уніфікована тривалість, захист від конкурентних польотів, обробка markerMoved.

'use strict';

import { markerLayer, defaultCenterLat, defaultCenterLon } from "./globe.js";
import { estimateAltitudeM } from "./camera_math.js";
import { LonLat } from '../../lib/og.es.js';

const DEFAULT_FLY_MS = 1200;
const MIN_FRAMES = 60;

let __cam = null;
let __isFlying = false;
let __flightToken = 0;
let __endTimer = null;
let __currentGlobus = null;

/** Повертає OG-камеру. */
function getCam(globus) {
  return globus?.planet?.camera || globus?.camera || __cam;
}

/** Нормалізація довготи до інтервалу [-180, 180). */
function normLon(lonDeg) {
  let x = ((lonDeg + 180) % 360 + 360) % 360 - 180;
  return x === -180 ? (180 - Number.EPSILON) : x;
}

/** Перевіряє, чи є дві точки антиподами */
function areAntipodes(lon1, lat1, lon2, lat2, toleranceDeg = 1.0) {
  const antiLon = normLon(lon1 + 180);
  const antiLat = -lat1;
  
  const lonDiff = Math.abs(normLon(lon2 - antiLon));
  const latDiff = Math.abs(lat2 - antiLat);
  
  return lonDiff <= toleranceDeg && latDiff <= toleranceDeg;
}

/** Обчислює проміжні точки для плавного переходу між антиподами */
function calculateAntipodeWaypoints(startLon, startLat, targetLon, targetLat, targetAltitude) {
  const waypoints = [];
  
  // Етап 1: Підйом на більшу висоту (для кращого огляду під час переходу)
  const higherAltitude = targetAltitude * 3; // Піднімаємося вище за цільову висоту
  waypoints.push({
    lon: startLon,
    lat: startLat,
    altitudeM: higherAltitude,
    durationFraction: 0.3
  });
  
  // Етап 2: Переміщення до проміжної точки біля екватора
  let intermediateLon = normLon(startLon + 90);
  if (Math.abs(startLat) > 60) {
    intermediateLon = normLon(startLon + 120);
  }
  
  waypoints.push({
    lon: intermediateLon,
    lat: 0, // Екватор
    altitudeM: higherAltitude,
    durationFraction: 0.4
  });
  
  // Етап 3: Плавний спуск до цільової точки з ПРАВИЛЬНОЮ висотою
  waypoints.push({
    lon: targetLon,
    lat: targetLat,
    altitudeM: targetAltitude, // Використовуємо цільову висоту, а не поточну!
    durationFraction: 0.3
  });
  
  return waypoints;
}

/** Підігнати цільову довготу під поточну, уникнувши «телепорту» через антимеридіан. */
function wrapLonNear(startLon, targetLon) {
  const s = normLon(startLon);
  let t = normLon(targetLon);

  let d = t - s;
  if (d > 180) t -= 360;
  else if (d < -180) t += 360;

  return normLon(t);
}

// Функція для зупинки інерції камери
function stopCameraInertia(globus) {
  const renderer = globus?.planet?.renderer;
  const nav = renderer?.controls?.mouseNavigation;
  const canvas = renderer?.handler?.canvas || document.getElementById('globe-container') || window;

  const stop = () => {
    try { if (nav && typeof nav.stop === 'function') nav.stop(); } catch {}
  };

  stop();
  
  const stopSoon = () => setTimeout(stop, 10);
  try { canvas.addEventListener('mouseup', stopSoon, { passive: true, once: true }); } catch {}
  try { canvas.addEventListener('touchend', stopSoon, { passive: true, once: true }); } catch {}
}

// Глушіння інерції миші/скролу
function _setupInertiaKill(globus) {
  const renderer = globus?.planet?.renderer;
  const nav = renderer?.controls?.mouseNavigation;
  const canvas = renderer?.handler?.canvas || document.getElementById('globe-container') || window;

  const stop = () => {
    try { if (nav && typeof nav.stop === 'function') nav.stop(); } catch {}
  };

  try { renderer?.events?.on?.('lup', stop); } catch {}
  try { renderer?.events?.on?.('rup', stop); } catch {}
  try { renderer?.events?.on?.('mup', stop); } catch {}

  try { canvas.addEventListener('mouseleave', stop, { passive: true }); } catch {}
  try { canvas.addEventListener('touchend', stop,   { passive: true }); } catch {}
  try { canvas.addEventListener('touchcancel', stop,{ passive: true }); } catch {}

  let wheelTimer = null;
  const onWheel = () => {
    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(stop, 140);
  };
  try { canvas.addEventListener('wheel', onWheel, { passive: true }); } catch {}
}

/** Акуратне завершення польоту. */
function finalizeFlight(token) {
  if (token !== __flightToken) return;
  __isFlying = false;
  if (__endTimer) {
    clearTimeout(__endTimer);
    __endTimer = null;
  }
}

/** Виконує політ до однієї точки */
function flyToSinglePoint(cam, target, durationMs) {
  const frames = Math.max(MIN_FRAMES, Math.floor(durationMs / 16));
  if (typeof cam._numFrames === 'number') cam._numFrames = frames;

  if (typeof cam.flyLonLat === 'function') {
    cam.flyLonLat(target);
  } else if (typeof cam.setLonLat === 'function') {
    cam.setLonLat(target);
  }
}

/** Публічний політ «у надір» над точкою (lon,lat) з висотою під коло. */
function flyToNadir({ globus, lon, lat, radiusM, altitudeM, durationMs = DEFAULT_FLY_MS }) {
  const cam = getCam(globus);
  if (!cam) return;

  abort();

  __isFlying = true;
  const myToken = ++__flightToken;

  try {
    // Отримуємо поточну позицію камери
    const curLL = (typeof cam.getLonLat === 'function') ? cam.getLonLat() : null;
    const curLon = curLL ? curLL.lon : 0;
    const curLat = curLL ? curLL.lat : 0;
    const currentH = cam.getHeight ? cam.getHeight() : (cam.getAltitude ? cam.getAltitude() : 1000000);

    // ОБЧИСЛЮЄМО ЦІЛЬОВУ ВИСОТУ НА ОСНОВІ РАДІУСА КОЛА
    const finalH = (typeof altitudeM === 'number' && altitudeM > 0)
      ? altitudeM
      : estimateAltitudeM(radiusM || 0, cam.getFov ? cam.getFov() : 45);

    // Перевіряємо, чи це політ між антиподами
    const isAntipodeFlight = areAntipodes(curLon, curLat, lon, lat);
    
    if (isAntipodeFlight) {
      console.log('[camera] Antipode flight detected, using multi-step approach');
      
      // Багатоетапний політ для антиподів - передаємо ЦІЛЬОВУ висоту
      const waypoints = calculateAntipodeWaypoints(curLon, curLat, lon, lat, finalH);
      let currentStep = 0;
      
      const executeNextStep = () => {
        if (currentStep >= waypoints.length) {
          finalizeFlight(myToken);
          return;
        }
        
        const waypoint = waypoints[currentStep];
        const stepDuration = durationMs * waypoint.durationFraction;
        
        const tLon = wrapLonNear(curLon, waypoint.lon);
        const target = new LonLat(tLon, waypoint.lat, waypoint.altitudeM);
        
        flyToSinglePoint(cam, target, stepDuration);
        
        currentStep++;
        
        if (currentStep < waypoints.length) {
          setTimeout(executeNextStep, stepDuration * 0.8);
        } else {
          setTimeout(() => finalizeFlight(myToken), stepDuration * 1.2);
        }
      };
      
      setTimeout(executeNextStep, 10);
      
    } else {
      // Звичайний політ - використовуємо цільову висоту
      const tLon = wrapLonNear(curLon, normLon(lon));
      const target = new LonLat(tLon, lat, finalH);

      flyToSinglePoint(cam, target, durationMs);
    }

    __endTimer = setTimeout(() => finalizeFlight(myToken), durationMs * 1.5);

    try {
      if (!cam.__orbitDoneHooked && typeof cam.on === 'function') {
        cam.on('moveend', () => {
          if (!isAntipodeFlight) {
            finalizeFlight(myToken);
          }
        });
        cam.__orbitDoneHooked = true;
      }
    } catch {}
  } catch (err) {
    console.error('[camera] flyToNadir error:', err);
    finalizeFlight(myToken);
  }
}

/** Зовнішній апі для контролерів. */
const cameraAPI = {
  flyToNadir: (opts) => flyToNadir(opts),
  isBusy: () => __isFlying,
  abort: () => abort(),
  stopInertia: () => {
    if (__currentGlobus) {
      stopCameraInertia(__currentGlobus);
    }
  }
};

/** Скасувати поточний політ. */
function abort() {
  __flightToken++;
  __isFlying = false;
  if (__endTimer) {
    clearTimeout(__endTimer);
    __endTimer = null;
  }
}

/** Ініціалізація камери (разово). */
export function initCamera(globus) {
  const cam = getCam(globus);
  if (!cam) return;

  __cam = cam;
  __currentGlobus = globus;
  cam.maxAltitude = 15_000_000;
  if (typeof cam.update === 'function') cam.update();
}

/** Оновлення камери за подіями UI/маркерів. */
export function updateCameraView(globus, context = { type: 'initial' }) {
  const cam = getCam(globus);
  if (!cam) return;

  if (context.type === 'initial') {
    return;
  }

  if (context.type === 'markerMoved') {
    try {
      const ents = markerLayer?.getEntities ? markerLayer.getEntities() : null;
      const ent = ents && ents.length ? ents[0] : null;
      const ll = ent?.lonLat || null;
      if (!ll) return;

      const currentH = (cam.getHeight ? cam.getHeight() :
                       (cam.getAltitude ? cam.getAltitude() : null));

      const altitudeM = typeof currentH === 'number' && currentH > 0 ? currentH : undefined;

      flyToNadir({
        globus,
        lon: ll.lon,
        lat: ll.lat,
        radiusM: undefined,
        altitudeM,
        durationMs: DEFAULT_FLY_MS
      });
    } catch (e) {
      console.warn('[camera] markerMoved handler failed:', e);
    }
    return;
  }
}

/** Доступ до API камери для інших модулів. */
export function getCameraAPI() {
  return cameraAPI;
}

/** Лічильник висоти (UI). */
export function updateAltimeterReadout(globus) {
  const cam = getCam(globus);
  const el = document.getElementById('altimeter');
  if (!el || !cam) return;
  try {
    const h = cam.getHeight ? cam.getHeight() :
             (cam.getAltitude ? cam.getAltitude() : 0);
    el.textContent = Math.round(h).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m';
  } catch {}
}