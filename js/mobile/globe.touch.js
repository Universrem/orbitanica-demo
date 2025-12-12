// /js/mobile/globe.touch.js
'use strict';

import { globus } from '../globe/globe.js';
import { placeMarker } from '../globe/markers.js';
import { getCameraAPI } from '../globe/camera.js';

let initialized = false;

function isMobileCoarse() {
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      return true;
    }
  } catch {}
  // запасний варіант – маленька ширина екрана
  return window.innerWidth <= 768;
}

function initGlobeTouchHelpers() {
  if (initialized) return;
  if (!isMobileCoarse()) return;

  const planet = globus?.planet;
  const canvas = planet?.renderer?.handler?.canvas;
  if (!planet || !canvas) return;

  const camApi = (typeof getCameraAPI === 'function') ? getCameraAPI() : null;
  const cam = planet.camera;
  if (!camApi || !cam) return;

  // доступ до керування “пальцями” всередині рушія (якщо є)
  const renderer = planet?.renderer;
  const touchNav = renderer?.controls?.touchNavigation || null;

  const navBase = {
    rot: (touchNav && typeof touchNav.rot === 'number') ? touchNav.rot : null,
    scaleRot: (touchNav && typeof touchNav.scaleRot === 'number') ? touchNav.scaleRot : null
  };

  let pinchRotationLocked = false;

  function safeStopInertia() {
    try {
      if (camApi && typeof camApi.stopInertia === 'function') camApi.stopInertia();
    } catch {}
  }

  function safeAbortAutoFlight() {
    try {
      if (camApi && typeof camApi.isBusy === 'function' && camApi.isBusy()) {
        if (typeof camApi.abort === 'function') camApi.abort();
      }
    } catch {}
  }

  function safeStopRotation() {
    try {
      if (touchNav && typeof touchNav.stopRotation === 'function') touchNav.stopRotation();
    } catch {}
  }

  function lockPinchRotation() {
    if (!touchNav) return;

    if (!pinchRotationLocked) {
      pinchRotationLocked = true;
    }

    // ідея: під час pinch занулюємо множник повороту саме для двопальцевого жесту
    try {
      if (typeof touchNav.scaleRot === 'number') touchNav.scaleRot = 0;
    } catch {}

    // якщо рушій уже “почав крутити” — гасимо
    safeStopRotation();
  }

  function unlockPinchRotation() {
    if (!touchNav) return;
    if (!pinchRotationLocked) return;

    pinchRotationLocked = false;

    try {
      if (navBase.scaleRot !== null && typeof touchNav.scaleRot === 'number') {
        touchNav.scaleRot = navBase.scaleRot;
      }
    } catch {}

    // повертаємо базову швидкість обертання (на випадок, якщо ми її змінювали для 1 пальця)
    try {
      if (navBase.rot !== null && typeof touchNav.rot === 'number') {
        touchNav.rot = navBase.rot;
      }
    } catch {}
  }

  function getCameraHeightM() {
    try {
      const h = cam.getHeight ? cam.getHeight()
        : (cam.getAltitude ? cam.getAltitude() : null);
      return (typeof h === 'number' && h > 0) ? h : null;
    } catch {
      return null;
    }
  }

  function applyOneFingerSpeedCompensation(startHeightM) {
    if (!touchNav) return;
    if (navBase.rot === null) return;

    const h = getCameraHeightM();
    if (!h || !startHeightM || startHeightM <= 0) return;

    // ідея: якщо ближче — обертання відчувається швидше; якщо далі — повільніше.
    // компенсуємо множником ~ (поточна висота / стартова висота)
    let k = h / startHeightM;

    // обмеження, щоб не робити “вибухи”
    if (k < 0.6) k = 0.6;
    if (k > 1.8) k = 1.8;

    try {
      if (typeof touchNav.rot === 'number') {
        touchNav.rot = navBase.rot * k;
      }
    } catch {}
  }

  function restoreOneFingerSpeed() {
    if (!touchNav) return;
    if (navBase.rot === null) return;
    try {
      if (typeof touchNav.rot === 'number') touchNav.rot = navBase.rot;
    } catch {}
  }

  // для розпізнавання короткого тапу
  let tapStartX = 0;
  let tapStartY = 0;
  let tapStartTime = 0;
  let tapMoved = false;
  const TAP_MAX_MS = 250;
  const TAP_MAX_MOVE = 10; // пікселі

  // для фіксації, що був pinch двома пальцями (або додали другий палець у процесі)
  let hadPinch = false;

  // для компенсації швидкості 1 пальця
  let dragStartHeightM = null;

  function onTouchStart(e) {
    if (!isMobileCoarse()) return;

    // якщо камера летить (наприклад, до кола) — дотик бере керування на себе
    safeAbortAutoFlight();

    // прибираємо накопичення інерції від попередніх жестів
    safeStopInertia();

    if (e.touches.length === 1) {
      const t = e.touches[0];

      tapStartX = t.clientX;
      tapStartY = t.clientY;
      tapStartTime = performance.now ? performance.now() : Date.now();
      tapMoved = false;

      hadPinch = false;
      unlockPinchRotation();

      dragStartHeightM = getCameraHeightM();
      restoreOneFingerSpeed();
      return;
    }

    if (e.touches.length >= 2) {
      hadPinch = true;
      tapMoved = true;

      dragStartHeightM = null;
      lockPinchRotation();
    }
  }

  function onTouchMove(e) {
    if (!isMobileCoarse()) return;

    // якщо під час руху додали другий палець — це pinch
    if (e.touches.length >= 2) {
      hadPinch = true;
      tapMoved = true;

      dragStartHeightM = null;
      lockPinchRotation();
      return;
    }

    // 1 палець
    if (e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - tapStartX;
    const dy = t.clientY - tapStartY;
    if (Math.sqrt(dx * dx + dy * dy) > TAP_MAX_MOVE) {
      tapMoved = true;
    }

    // якщо вже був pinch (два пальці) і лишився один — не намагаємось “перевести” це у drag
    if (hadPinch) return;

    // м’яка компенсація швидкості обертання на різній висоті
    if (dragStartHeightM) {
      applyOneFingerSpeedCompensation(dragStartHeightM);
    }
  }

  // м’яко вирівняти камеру «вниз» на те місце, куди зараз дивимось
  function alignCameraToNadir() {
    try {
      const ll = (typeof cam.getLonLat === 'function') ? cam.getLonLat() : null;
      if (!ll) return;

      const h = cam.getHeight
        ? cam.getHeight()
        : (cam.getAltitude ? cam.getAltitude() : null);

      const altitudeM = (typeof h === 'number' && h > 0) ? h : undefined;

      camApi.flyToNadir({
        globus,
        lon: ll.lon,
        lat: ll.lat,
        altitudeM,
        radiusM: undefined,
        durationMs: 250
      });
    } catch (err) {
      console.warn('[mobile/globe.touch] alignCameraToNadir failed:', err);
    }
  }

  function onTouchEnd(e) {
    if (!isMobileCoarse()) return;

    // після завершення жесту — гасимо інерцію, щоб вона не накопичувалась
    safeStopInertia();

    const noTouchesLeft = e.touches.length === 0;

    // КООРДИНАТИ КІНЦЯ ЖЕСТУ (а не початку)
    let endX = tapStartX;
    let endY = tapStartY;

    if (e.changedTouches && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      endX = t.clientX;
      endY = t.clientY;
    }

    // 1) Якщо був pinch двома пальцями – після завершення просто вирівнюємо камеру
    if (noTouchesLeft && hadPinch) {
      hadPinch = false;
      unlockPinchRotation();
      restoreOneFingerSpeed();
      alignCameraToNadir();
      return;
    }

    // 2) Один палець: короткий, майже нерухомий тап = поставити мітку
    if (noTouchesLeft && !hadPinch) {
      unlockPinchRotation();
      restoreOneFingerSpeed();

      const now = performance.now ? performance.now() : Date.now();
      const dt = now - tapStartTime;

      if (!tapMoved && dt <= TAP_MAX_MS) {
        const rect = canvas.getBoundingClientRect();

        // Позиція пальця всередині прямокутника полотна (в «екранних» пікселях)
        const relX = endX - rect.left;
        const relY = endY - rect.top;

        // Переводимо в «внутрішні» пікселі самого canvas (там інший розмір)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = relX * scaleX;
        const y = relY * scaleY;

        const lonLat = planet.getLonLatFromPixelTerrain({ x, y });
        if (lonLat) {
          placeMarker(lonLat.lon, lonLat.lat);
          return;
        }
      }

      // Якщо це було перетягування одним пальцем – після нього трішки
      // вирівнюємо камеру, щоб знову дивитись зверху
      alignCameraToNadir();
    }
  }

  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });

  initialized = true;
}

if (document.readyState !== 'loading') {
  initGlobeTouchHelpers();
} else {
  document.addEventListener('DOMContentLoaded', initGlobeTouchHelpers, { once: true });
}
