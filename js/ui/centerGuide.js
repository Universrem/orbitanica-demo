// /js/ui/centerGuide.js
'use strict';

const STORAGE_KEY = 'orbit:centerGuide.center';

function hasSeenCenterGuide() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markCenterGuideSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // localStorage може бути недоступний — ігноруємо
  }
}

// debug-режим: ?guide_debug=1 у URL (для тестів на localhost)
function isGuideDebugMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('guide_debug') === '1';
  } catch {
    return false;
  }
}

export function initCenterGuide() {
  const hint = document.getElementById('center-guide-hint');
  if (!hint) return;

  const okBtn = hint.querySelector('.center-guide-ok');
  if (!okBtn) return;

  const debug = isGuideDebugMode();

  const showHint = () => {
    hint.classList.add('is-active');
  };

  const hideHint = () => {
    hint.classList.remove('is-active');
  };

  // Звичайний режим: якщо вже бачив — не показуємо
  if (!debug && hasSeenCenterGuide()) {
    hideHint();
    return;
  }

  // Перший захід (або debug): показуємо стрічку
  showHint();

  // У debug не чіпаємо localStorage, у проді — фіксуємо, що гід пройшли
  if (!debug) {
    markCenterGuideSeen();
  }

  // "Ок" — ховає стрічку
  okBtn.addEventListener(
    'click',
    () => {
      hideHint();
    },
    { once: true }
  );

  // Поставили мітку → теж ховаємо стрічку
  window.addEventListener('orbit:center-changed', () => {
    hideHint();
  });

  // Запустили сцену (центр = Львів) → теж ховаємо стрічку
  window.addEventListener('orbit:centerGuide-dismiss', () => {
    hideHint();
  });
}
