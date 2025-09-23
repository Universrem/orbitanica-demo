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
    if (threeCam) { threeCam.far = 200_000_000; threeCam.updateProjectionMatrix(); }
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
/**
 * Повертає адаптер камери для інших модулів (наприклад, circle_focus.controller).
 * Має методи:
 *  - getFovDeg(): number | undefined
 *  - flyToNadir({ lon, lat, altitudeM, durationMs }): void
 */
export function getCameraAPI(globus) {
  const cam = globus?.planet?.camera;
  const ellipsoid = globus?.planet?.ellipsoid;
  if (!cam || !ellipsoid) throw new Error('[camera.js] Planet camera / ellipsoid not available');

  // ── константи/утиліти
  const R = 6_371_008.8;
  const DEG = Math.PI / 180;
  const toRad = (d) => d * DEG;

  const normLon = (lon) => {
    let L = lon; while (L < -180) L += 360; while (L >= 180) L -= 360; return L;
  };

  const getFov = () => {
    const threeCam = cam.camera;
    return (threeCam && typeof threeCam.fov === 'number') ? threeCam.fov : 45;
  };

  const estimateAlt = (radiusM, fovDeg) => {
    const delta = Math.max(0, Math.min(Math.PI, radiusM / R)); // рад
    const eff   = Math.min(delta, Math.PI - delta);
    const fovR  = Math.max(15*DEG, Math.min(90*DEG, fovDeg*DEG));
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
    } catch {}
    return new LonLat(defaultCenterLon, defaultCenterLat);
  };

  const angularDistanceDeg = (a, b) => {
    const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
    const λ1 = toRad(a.lon), λ2 = toRad(b.lon);
    const s = Math.acos(Math.min(1, Math.max(-1,
      Math.sin(φ1)*Math.sin(φ2) + Math.cos(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1)
    )));
    return s * (180 / Math.PI);
  };

  // Гарантії перед рухом
  const ensureFarAndStop = () => {
    const threeCam = cam.camera;
    if (threeCam && (threeCam.far || 0) < 200_000_000) {
      threeCam.far = 200_000_000; threeCam.updateProjectionMatrix();
    }
    if (typeof cam.stopFlying === 'function') cam.stopFlying();
  };

  const getCurrentHeight = () => {
    return (typeof cam.getHeight === 'function') ? cam.getHeight() :
           (typeof cam.getAltitude === 'function') ? cam.getAltitude() : 1_000_000;
  };

  // ── PRE-ALIGN: м’яко повернутися в надір над поточним центром
  const preAlignNadir = (token, alignDurMs = 220) => {
    ensureFarAndStop();
    const centerLL = getSceneCenterLL();
    const h = Math.max(50, getCurrentHeight());

    // якщо є setView — скористаємося; якщо ні — миттєвий flyLonLat на 1 кадр
    try {
      if (typeof cam.setView === 'function') {
        cam._numFrames = 1;
        cam.setView(centerLL, h, 0, -90, 0); // heading=0, pitch=-90, roll=0
      } else {
        cam._numFrames = 1;
        cam.flyLonLat(new LonLat(centerLL.lon, centerLL.lat, h));
      }
    } catch {
      cam._numFrames = 1;
      cam.flyLonLat(new LonLat(centerLL.lon, centerLL.lat, h));
    }

    // короткий «дрібний» підліт для стабілізації після ручного кручення
    cam._numFrames = Math.max(1, Math.floor(alignDurMs / 16));
    cam.flyLonLat(new LonLat(centerLL.lon, centerLL.lat, h));
  };

  // Таймлайн із токеном
  let flightToken = 0;
  const startStage = (token, durMs, ll, height, framesBoost = 1, next) => {
    if (token !== flightToken) return;
    ensureFarAndStop();
    // більше кадрів → плавніше; framesBoost>1 — для фінального спуску (ease-out)
    const frames = Math.max(1, Math.floor((durMs / 16) * framesBoost));
    cam._numFrames = frames;
    cam.flyLonLat(new LonLat(ll.lon, ll.lat, height));
    setTimeout(() => { if (token === flightToken && typeof next === 'function') next(); }, durMs + 40);
  };

  // Серія «холд-фіксацій» у фіналі — прибирає перефокус у самому кінці
  const finalHoldSeries = (token, ll, height, repeats = 6, intervalMs = 60) => {
    let i = 0;
    const tick = () => {
      if (token !== flightToken || i >= repeats) return;
      ensureFarAndStop();
      cam._numFrames = 1;
      // якщо є setView — він фіксує надір на 100%
      if (typeof cam.setView === 'function') {
        cam.setView(new LonLat(ll.lon, ll.lat), height, 0, -90, 0);
      } else {
        cam.flyLonLat(new LonLat(ll.lon, ll.lat, height));
      }
      i++;
      setTimeout(tick, intervalMs);
    };
    tick();
  };

  // 3 етапи з м’яким спуском (ease-out)
  const flyThreeStage = (token, { startLL, targetLL, finalHeight, durationMs }) => {
    const total = Math.max(800, durationMs|0);
    const upDur = Math.floor(total * 0.20);     // 20%
    const mvDur = Math.floor(total * 0.55);     // 55%
    const dnDur = total - upDur - mvDur;        // 25%

    const climbAlt  = Math.max(800_000, Math.min(10_000_000, Math.max(finalHeight * 2, 800_000)));
    const cruiseAlt = Math.max(1_500_000, Math.min(15_000_000, Math.max(climbAlt * 1.25, 1_500_000)));

    // 1) підйом
    startStage(token, upDur, startLL, climbAlt, 1, () => {
      // 2) переліт
      startStage(token, mvDur, targetLL, cruiseAlt, 1, () => {
        // 3) спуск із підвищеним числом кадрів (м'якше)
        startStage(token, dnDur, targetLL, finalHeight, 1.6, () => {
          finalHoldSeries(token, targetLL, finalHeight, 6, 60);
        });
      });
    });
  };

  return {
    getFovDeg() { return getFov(); },

    /**
     * Політ у надір над (lon,lat).
     * Працює і з altitudeM (передає контролер), і з radiusM (тоді висоту рахуємо тут).
     * Для «> екватора» очікуємо, що lon/lat уже фліпнуті контролером.
     */
    flyToNadir({ lon, lat, radiusM, altitudeM, durationMs = 1500 }) {
      // Старт нового польоту
      flightToken++;
      const token = flightToken;

      const fov = getFov();
      const finalH = (typeof altitudeM === 'number' && altitudeM > 0)
        ? altitudeM
        : (typeof radiusM === 'number' && radiusM > 0)
          ? estimateAlt(radiusM, fov)
          : 1_000_000;

      const targetLL = new LonLat(normLon(lon), lat, finalH);
      const startLL  = getSceneCenterLL();

      // 0) pre-align (м'яко прибирає інерцію/нахил після ручного кручення)
      preAlignNadir(token, 220);

      // 1) визначити потрібний маршрут: короткий чи довгий
      const ang = angularDistanceDeg(startLL, targetLL);
      if (ang > 45) {
        flyThreeStage(token, { startLL, targetLL, finalHeight: finalH, durationMs });
      } else {
        // короткий переліт: один етап із трохи більшим числом кадрів + холд-серія
        startStage(token, Math.max(600, durationMs|0), targetLL, finalH, 1.2, () => {
          finalHoldSeries(token, targetLL, finalH, 6, 60);
        });
      }
    }
  };
}

/**
 * Оновлює лічильник висоти (#altimeter), якщо такий елемент існує.
 * Викликай при потребі (наприклад, з requestAnimationFrame у головному циклі або з подій камери).
 */
export function updateAltimeterReadout(globus) {
  const el = document.getElementById('altimeter');
  if (!el) return;

  const cam = globus?.planet?.camera;
  if (!cam) return;

  const h =
    (typeof cam.getHeight === 'function') ? cam.getHeight() :
    (typeof cam.getAltitude === 'function') ? cam.getAltitude() :
    0;

  // Формат у метрах з розділювачами
  const fmt = (m) => {
    const s = Math.round(m).toString();
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  el.textContent = `${fmt(h)} m`;
}


