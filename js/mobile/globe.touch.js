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

  const planet  = globus?.planet;
  const canvas  = planet?.renderer?.handler?.canvas;
  if (!planet || !canvas) return;

  const camApi  = (typeof getCameraAPI === 'function') ? getCameraAPI() : null;
  const cam     = planet.camera;

  if (!camApi || !cam) return;

  // для розпізнавання короткого тапу
  let tapStartX = 0;
  let tapStartY = 0;
  let tapStartTime = 0;
  let tapMoved = false;
  const TAP_MAX_MS   = 250;
  const TAP_MAX_MOVE = 10; // пікселі

  // для фіксації, що був pinch двома пальцями
  let hadPinch = false;

  function onTouchStart(e) {
    if (!isMobileCoarse()) return;

    if (e.touches.length === 1) {
      const t = e.touches[0];
      tapStartX = t.clientX;
      tapStartY = t.clientY;
      tapStartTime = performance.now ? performance.now() : Date.now();
      tapMoved = false;
      // почався один палець – поки що не pinch
      hadPinch = false;
    } else if (e.touches.length >= 2) {
      // два й більше пальців – запам’ятовуємо, що був pinch
      hadPinch = true;
    }
  }

  function onTouchMove(e) {
    if (!isMobileCoarse()) return;
    if (e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - tapStartX;
    const dy = t.clientY - tapStartY;
    if (Math.sqrt(dx * dx + dy * dy) > TAP_MAX_MOVE) {
      tapMoved = true;
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
        lon       : ll.lon,
        lat       : ll.lat,
        altitudeM,
        radiusM   : undefined,
        durationMs: 250
      });
    } catch (err) {
      console.warn('[mobile/globe.touch] alignCameraToNadir failed:', err);
    }
  }

      function onTouchEnd(e) {
    if (!isMobileCoarse()) return;

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
      alignCameraToNadir();
      return;
    }

    // 2) Один палець: короткий, майже нерухомий тап = поставити мітку
    if (noTouchesLeft && !hadPinch) {
      const now = performance.now ? performance.now() : Date.now();
      const dt = now - tapStartTime;

      if (!tapMoved && dt <= TAP_MAX_MS) {
        const rect = canvas.getBoundingClientRect();

        // Позиція пальця всередині прямокутника полотна (в «екранних» пікселях)
        const relX = endX - rect.left;
        const relY = endY - rect.top;

        // Переводимо в «внутрішні» пікселі самого canvas (там інший розмір)
        const scaleX = canvas.width  / rect.width;
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
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: true });
  canvas.addEventListener('touchend',   onTouchEnd,   { passive: true });
  canvas.addEventListener('touchcancel', onTouchEnd,  { passive: true });

  initialized = true;
}

if (document.readyState !== 'loading') {
  initGlobeTouchHelpers();
} else {
  document.addEventListener('DOMContentLoaded', initGlobeTouchHelpers, { once: true });
}
