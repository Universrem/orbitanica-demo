// full/js/main.js
'use strict';

import './globe/globe.js';
import { initI18n, t } from './i18n.js';
import { initLeftPanel } from './panel.js';
import './events/panel_buttons.js';
import './userObjects/modal.js';
import './ui/langMenu.js';

(async function boot() {
  const start = async () => {
    await initI18n();     // 1) підняти словник і встановити мову
    initLeftPanel(t);     // 2) згенерити ліву панель, передавши t
  };

  if (document.readyState !== 'loading') {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();


