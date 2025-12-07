// /js/mobile/gestures.js
'use strict';

const MOBILE_MEDIA_QUERY = '(max-width: 768px)';

function isMobile() {
  return window.matchMedia && window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

/* ================== СЦЕНИ (листок зліва) ================== */

function initScenesHandle() {
  const handle = document.getElementById('mobile-handle-scenes');
  if (!handle) return;

  const body = document.body;
  let startX = 0;
  let dragging = false;
  let openedAtStart = false;

  const THRESHOLD = 40;      // мінімальний свайп (px)
  const TAP_THRESHOLD = 5;   // майже без руху → тап

  function isOpen() {
    return body.classList.contains('mobile-scenes-open');
  }

  function open() {
    body.classList.add('mobile-scenes-open');
    body.classList.remove('mobile-info-open');
  }

  function close() {
    body.classList.remove('mobile-scenes-open');
  }

  function onPointerDown(e) {
    if (!isMobile()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    dragging = true;
    startX = e.clientX;
    openedAtStart = isOpen();

    try { handle.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerMove(_e) {
    if (!dragging) return;
    // Якщо захочеш живий рух панелі під пальцем — додамо тут
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;

    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}

    const delta = e.clientX - startX;
    const absDelta = Math.abs(delta);

    // ТАП: просто тумблер
    if (absDelta < TAP_THRESHOLD) {
      if (openedAtStart) close();
      else open();
      return;
    }

    // Свайп ВПРАВО → відкриваємо
    if (delta > THRESHOLD) {
      open();
      return;
    }

    // Свайп ВЛІВО → закриваємо
    if (delta < -THRESHOLD) {
      close();
      return;
    }
  }

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', onPointerUp);
}

function initScenesPanelSwipe() {
  const panel = document.getElementById('left-panel');
  if (!panel) return;

  const body = document.body;
  let startX = 0;
  let dragging = false;
  const THRESHOLD = 40;

  function isOpen() {
    return body.classList.contains('mobile-scenes-open');
  }

  function close() {
    body.classList.remove('mobile-scenes-open');
  }

  function onPointerDown(e) {
    if (!isMobile()) return;
    if (!isOpen()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    dragging = true;
    startX = e.clientX;

    try { panel.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerMove(_e) {
    if (!dragging) return;
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;

    try { panel.releasePointerCapture(e.pointerId); } catch (_) {}

    const delta = e.clientX - startX;

    // Свайп ВЛІВО → закриваємо
    if (delta < -THRESHOLD) {
      close();
    }
  }

  panel.addEventListener('pointerdown', onPointerDown);
  panel.addEventListener('pointermove', onPointerMove);
  panel.addEventListener('pointerup', onPointerUp);
  panel.addEventListener('pointercancel', onPointerUp);
}

/* ================== ІНФО (листок справа) ================== */

function initInfoHandle() {
  const handle = document.getElementById('mobile-handle-info');
  if (!handle) return;

  const body = document.body;
  let startX = 0;
  let dragging = false;
  let openedAtStart = false;

  const THRESHOLD = 40;
  const TAP_THRESHOLD = 5;

  function isOpen() {
    return body.classList.contains('mobile-info-open');
  }

  function open() {
    body.classList.add('mobile-info-open');
    body.classList.remove('mobile-scenes-open');
  }

  function close() {
    body.classList.remove('mobile-info-open');
  }

  function onPointerDown(e) {
    if (!isMobile()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    dragging = true;
    startX = e.clientX;
    openedAtStart = isOpen();

    try { handle.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerMove(_e) {
    if (!dragging) return;
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;

    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}

    const delta = e.clientX - startX;
    const absDelta = Math.abs(delta);

    // ТАП → тумблер
    if (absDelta < TAP_THRESHOLD) {
      if (openedAtStart) close();
      else open();
      return;
    }

    // Для інфо все дзеркально:
    // Свайп ВЛІВО → відкриваємо
    if (delta < -THRESHOLD) {
      open();
      return;
    }

    // Свайп ВПРАВО → закриваємо
    if (delta > THRESHOLD) {
      close();
      return;
    }
  }

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', onPointerUp);
}

function initInfoPanelSwipe() {
  const panel = document.getElementById('info-panel');
  if (!panel) return;

  const body = document.body;
  let startX = 0;
  let dragging = false;
  const THRESHOLD = 40;

  function isOpen() {
    return body.classList.contains('mobile-info-open');
  }

  function close() {
    body.classList.remove('mobile-info-open');
  }

  function onPointerDown(e) {
    if (!isMobile()) return;
    if (!isOpen()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    dragging = true;
    startX = e.clientX;

    try { panel.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerMove(_e) {
    if (!dragging) return;
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;

    try { panel.releasePointerCapture(e.pointerId); } catch (_) {}

    const delta = e.clientX - startX;

    // Свайп ВПРАВО → закриваємо
    if (delta > THRESHOLD) {
      close();
    }
  }

  panel.addEventListener('pointerdown', onPointerDown);
  panel.addEventListener('pointermove', onPointerMove);
  panel.addEventListener('pointerup', onPointerUp);
  panel.addEventListener('pointercancel', onPointerUp);
}

/* ================== Старт ================== */

function initMobileGestures() {
  if (!isMobile()) return;

  initScenesHandle();
  initScenesPanelSwipe();

  initInfoHandle();
  initInfoPanelSwipe();
}

if (document.readyState !== 'loading') {
  initMobileGestures();
} else {
  document.addEventListener('DOMContentLoaded', initMobileGestures, { once: true });
}
