// /js/main.js
'use strict';

import './globe/globe.js';
import { initI18n, t } from './i18n.js';
import { initLeftPanel } from './panel.js';
import { initPublicScenesPanel } from '/js/panels/publicScenes.panel.js';
import './events/panel_buttons.js';
import './events/distance_buttons.js';
import './events/luminosity_buttons.js';
import './events/diameter_buttons.js';
import './events/mass_buttons.js';
import './userObjects/modal.js';
import './ui/langMenu.js';
import './ui/zoomButtons.js';
import './mobile/gestures.js';
import './mobile/globe.touch.js';
import './mobile/infoModal.js';
import { initCenterGuide } from './ui/centerGuide.js'; // ← підключаємо гід

(async function boot() {
  const start = async () => {
    await initI18n();      // 1) словник і мова
    document.body.classList.add('i18n-ready');
    initLeftPanel(t);      // 2) ліва панель
    initPublicScenesPanel(); // 3) публічні сцени
    initCenterGuide();     // 4) гід над глобусом — тільки тепер, коли тексти вже є
  };

  if (document.readyState !== 'loading') {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
