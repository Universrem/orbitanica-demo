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

/** Повертає OG-камеру. */
function getCam(globus) {
  return globus?.planet?.camera || globus?.camera || __cam;
}

/** Нормалізація довготи до інтервалу [-180, 180). */
function normLon(lonDeg) {
  let x = ((lonDeg + 180) % 360 + 360) % 360 - 180;
  // уникаємо двозначності рівно на шві
  return x === -180 ? (180 - Number.EPSILON) : x;
}
/** Підігнати цільову довготу під поточну, уникнувши «телепорту» через антимеридіан. */
function wrapLonNear(startLon, targetLon) {
  // 1) нормалізуємо обидві довготи у [-180,180)
  const s = normLon(startLon);
  let t = normLon(targetLon);

  // 2) вибираємо найближчий «екземпляр» t відносно s, додаючи/віднімаючи 360 за потреби
  let d = t - s;
  if (d > 180) t -= 360;
  else if (d < -180) t += 360;

  // 3) повторно нормалізуємо у [-180,180)
  t = normLon(t);

  // 4) якщо різниця ≈ 180°, зрушуємо на епсилон, щоб задати однозначний напрямок польоту
  let delta = Math.abs(t - s);
  if (delta > 180) delta = 360 - delta;
  if (Math.abs(delta - 180) < 1e-9) {
    // легкий поштовх у бік найкоротшого шляху
    t = normLon(t + (t > s ? -1e-6 : 1e-6));
  }

  return t;
}


/** Акуратне завершення польоту. */
function finalizeFlight(token) {
  if (token !== __flightToken) return; // вже скасовано/перезапущено
  __isFlying = false;
  if (__endTimer) {
    clearTimeout(__endTimer);
    __endTimer = null;
  }
}

/** Публічний політ «у надір» над точкою (lon,lat) з висотою під коло. */
function flyToNadir({ globus, lon, lat, radiusM, altitudeM, durationMs = DEFAULT_FLY_MS }) {
  const cam = getCam(globus);
  if (!cam) return;

  // обчислюємо висоту єдиним способом
  const finalH = (typeof altitudeM === 'number' && altitudeM > 0)
    ? altitudeM
    : estimateAltitudeM(radiusM || 0, cam.getFov ? cam.getFov() : 45);

  // скасувати попередній політ (м'яко)
  abort();

  __isFlying = true;
  const myToken = ++__flightToken;

  try {
    // підігнати кількість кадрів під тривалість (≈60fps)
    const frames = Math.max(MIN_FRAMES, Math.floor((durationMs || DEFAULT_FLY_MS) / 16));
    if (typeof cam._numFrames === 'number') cam._numFrames = frames;

    const curLL = (typeof cam.getLonLat === 'function') ? cam.getLonLat() : null;
const curLon = curLL ? curLL.lon : 0;
const tLon = wrapLonNear(curLon, normLon(lon));
const target = new LonLat(tLon, lat, finalH);

    if (typeof cam.flyLonLat === 'function') {
      cam.flyLonLat(target);
    } else if (typeof cam.setLonLat === 'function') {
      cam.setLonLat(target);
    }

    // Страховка завершення: через durationMs скинемо прапор, якщо події від OG нема.
    __endTimer = setTimeout(() => finalizeFlight(myToken), durationMs || DEFAULT_FLY_MS);

    // Якщо OG має подію/зворотній виклик завершення — підпишемось один раз.
    // (без прив'язки до конкретного API, просто пробуємо)
    try {
      if (!cam.__orbitDoneHooked && typeof cam.on === 'function') {
        cam.on('moveend', () => finalizeFlight(myToken));
        cam.__orbitDoneHooked = true;
      }
    } catch {}
  } catch (err) {
    console.error('[camera] flyToNadir error:', err);
    finalizeFlight(myToken); // щоб не «завис» прапор
  }
}

/** Зовнішній апі для контролерів. */
const cameraAPI = {
  flyToNadir: (opts) => flyToNadir(opts),
  isBusy: () => __isFlying,
  abort: () => abort(),
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
  cam.maxAltitude = 15_000_000;
  if (typeof cam.update === 'function') cam.update();
}

/** Оновлення камери за подіями UI/маркерів. */
export function updateCameraView(globus, context = { type: 'initial' }) {
  const cam = getCam(globus);
  if (!cam) return;

  if (context.type === 'initial') {
    // вже зроблено в initCamera, нічого не робимо
    return;
  }

  if (context.type === 'markerMoved') {
    try {
      // знайдемо активний маркер
      const ents = markerLayer?.getEntities ? markerLayer.getEntities() : null;
      const ent = ents && ents.length ? ents[0] : null;
      const ll = ent?.lonLat || null;
      if (!ll) return;

      // Летимо до маркера, зберігаючи поточний масштаб (висоту)
      const currentH = (cam.getHeight ? cam.getHeight() :
                       (cam.getAltitude ? cam.getAltitude() : null));

      const altitudeM = typeof currentH === 'number' && currentH > 0 ? currentH : undefined;

      flyToNadir({
        globus,
        lon: ll.lon,
        lat: ll.lat,
        radiusM: undefined,   // не змінюємо масштаб
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
