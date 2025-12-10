// /js/mobile/gestures.js
'use strict';

/**
 * Мобільна логіка для висувних панелей:
 * - scenes (ліва панель)
 * - info (права панель / інфоблок)
 *
 * Керує:
 * - #mobile-handle-scenes
 * - #mobile-handle-info
 * - #mobile-overlay
 * - #left-panel
 * - #info-panel (підʼєднується, коли зʼявляється в DOM)
 */

const leftPanel = document.getElementById('left-panel');

const handleScenes = document.getElementById('mobile-handle-scenes');
const handleInfo = document.getElementById('mobile-handle-info');
const mobileOverlay = document.getElementById('mobile-overlay');

if (handleScenes && handleInfo && mobileOverlay) {
  let openPanel = null; // 'scenes' | 'info' | null

  function isMobile() {
    // Підлаштування під мобільну версію — тільки там працюють свайпи та ручки
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function applyState() {
    // Класи на body — в /style/mobile.css привʼязана анімація та позиціювання
    document.body.classList.toggle('mobile-scenes-open', openPanel === 'scenes');
    document.body.classList.toggle('mobile-info-open', openPanel === 'info');

    const hasOpen = openPanel !== null;
    document.body.classList.toggle('mobile-panel-open', hasOpen);

    // ARIA для ручок
    handleScenes.setAttribute('aria-pressed', openPanel === 'scenes' ? 'true' : 'false');
    handleInfo.setAttribute('aria-pressed', openPanel === 'info' ? 'true' : 'false');

    // Оверлей: показ/приховування віддаємо на CSS, але додаємо стан
    mobileOverlay.setAttribute('data-open', hasOpen ? 'true' : 'false');
  }

  function openScenes() {
    if (!isMobile()) return;
    openPanel = 'scenes';
    applyState();
  }

  function openInfo() {
    if (!isMobile()) return;
    openPanel = 'info';
    applyState();
  }

  function closePanels() {
    openPanel = null;
    applyState();
  }

  // Клік по ручці "Сцени"
  handleScenes.addEventListener('click', () => {
    if (!isMobile()) return;
    openPanel = openPanel === 'scenes' ? null : 'scenes';
    applyState();
  });

  // Клік по ручці "Інфо"
  handleInfo.addEventListener('click', () => {
    if (!isMobile()) return;
    openPanel = openPanel === 'info' ? null : 'info';
    applyState();
  });

  // Клік по затемненню — закриває будь-яку панель
  mobileOverlay.addEventListener('click', () => {
    if (!isMobile()) return;
    if (openPanel !== null) {
      closePanels();
    }
  });

  // Закривати мобільні панелі, коли екран розтягується до десктопу
  window.addEventListener('resize', () => {
    if (!isMobile() && openPanel !== null) {
      closePanels();
    }
  });

  // --- Свайпи для закриття панелей ---

  const SWIPE_THRESHOLD = 50; // px

  function attachSwipeToPanel(panelEl, side) {
    if (!panelEl) return;

    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let active = false;

    panelEl.addEventListener(
      'touchstart',
      (e) => {
        if (!isMobile()) return;
        if (!openPanel) return; // закриваємо тільки вже відкриту панель

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        isDragging = false;
        active = true;
      },
      { passive: true }
    );

    panelEl.addEventListener(
      'touchmove',
      (e) => {
        if (!active || !isMobile()) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        // Визначаємо, що це саме горизонтальний жест
        if (!isDragging) {
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
            isDragging = true;
          } else if (Math.abs(dy) > 10) {
            // Пальцем пішли по вертикалі — даємо сторінці скролитись
            active = false;
          }
        }
      },
      { passive: true }
    );

    panelEl.addEventListener(
      'touchend',
      (e) => {
        if (!active || !isMobile()) return;
        active = false;

        if (!isDragging) return;

        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;

        if (side === 'left') {
          // Ліва панель закривається свайпом ЛІВОРУЧ
          if (dx < -SWIPE_THRESHOLD && openPanel === 'scenes') {
            closePanels();
          }
        } else if (side === 'right') {
          // Права панель закривається свайпом ПРАВОРУЧ
          if (dx > SWIPE_THRESHOLD && openPanel === 'info') {
            closePanels();
          }
        }
      },
      { passive: true }
    );
  }

  // Свайп для лівої панелі: жест назовні (вліво) — закриття
  attachSwipeToPanel(leftPanel, 'left');

  // Свайп для правої панелі (інфоблок) підключаємо, коли вона реально створена infoPanel.js
  let infoSwipeAttached = false;

  window.addEventListener('orbitanica:info-panel-ready', (e) => {
    if (infoSwipeAttached) return;
    const panel = e && e.detail;
    if (!panel) return;

    attachSwipeToPanel(panel, 'right');
    infoSwipeAttached = true;
  });

  // --- Edge-свайпи для ВІДКРИТТЯ панелей ---

  const EDGE_ZONE = 30; // px від краю екрана

  let edgeStartX = 0;
  let edgeStartY = 0;
  let edgeDragging = false;
  let edgeActive = false;
  let edgeSide = null; // 'left' | 'right'

  window.addEventListener(
    'touchstart',
    (e) => {
      if (!isMobile()) return;
      if (openPanel) return; // edge-свайп на відкриття працює лише коли нічого не відкрито

      const touch = e.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;
      const vw = window.innerWidth;

      if (x <= EDGE_ZONE) {
        edgeSide = 'left';
      } else if (x >= vw - EDGE_ZONE) {
        edgeSide = 'right';
      } else {
        edgeSide = null;
        return;
      }

      edgeStartX = x;
      edgeStartY = y;
      edgeDragging = false;
      edgeActive = true;
    },
    { passive: true }
  );

  window.addEventListener(
    'touchmove',
    (e) => {
      if (!edgeActive || !isMobile()) return;

      const touch = e.touches[0];
      const dx = touch.clientX - edgeStartX;
      const dy = touch.clientY - edgeStartY;

      if (!edgeDragging) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          edgeDragging = true;
        } else if (Math.abs(dy) > 10) {
          // пішли скролити вертикально — не вважаємо це edge-свайпом
          edgeActive = false;
        }
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'touchend',
    (e) => {
      if (!edgeActive || !isMobile()) return;
      edgeActive = false;

      if (!edgeDragging) {
        edgeSide = null;
        return;
      }

      const touch = e.changedTouches[0];
      const dx = touch.clientX - edgeStartX;

      if (edgeSide === 'left') {
        // Від лівого краю вправо — відкриваємо ліву панель (сцени)
        if (dx > SWIPE_THRESHOLD && !openPanel) {
          openScenes();
        }
      } else if (edgeSide === 'right') {
        // Від правого краю вліво — відкриваємо праву панель (інфо)
        if (dx < -SWIPE_THRESHOLD && !openPanel) {
          openInfo();
        }
      }

      edgeSide = null;
    },
    { passive: true }
  );

  // Початкове приведення стану до порядку
  applyState();
}
