// full/js/ui/langMenu.js
'use strict';

import { setLanguage, getCurrentLang } from '../i18n.js';
import { resetAllUI } from '../events/reset.js';

(function initLangMenu() {
  document.addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('lang-menu');
    const btn = document.getElementById('lang-button');
    const list = document.getElementById('lang-dropdown');
    const cur = document.getElementById('lang-current');
    if (!menu || !btn || !list || !cur) return;

    const syncButton = () => {
  let lang = 'ua';
  try {
    const saved = localStorage.getItem('orbit:lang');
    if (saved && ['ua','en','es'].includes(saved)) {
      lang = saved;
    } else if (typeof getCurrentLang === 'function') {
      lang = getCurrentLang() || 'ua';
    }
  } catch {
    if (typeof getCurrentLang === 'function') lang = getCurrentLang() || 'ua';
  }
  cur.textContent = lang.toUpperCase();
};

    syncButton();

    const open = () => { list.hidden = false; btn.setAttribute('aria-expanded','true'); };
    const close = () => { list.hidden = true;  btn.setAttribute('aria-expanded','false'); };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (list.hidden) open(); else close();
    });

    document.addEventListener('click', close);

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    document.addEventListener('languageChanged', (e) => {
  const lang = (e && e.detail) ? String(e.detail) : (localStorage.getItem('orbit:lang') || 'ua');
  cur.textContent = lang.toUpperCase();
});


    list.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-lang]');
      if (!li) return;
      const lang = li.getAttribute('data-lang');
      if (!lang) return;

      // Якщо сесія активна — попереджаємо
      if (window.__orbitSessionActive) {
        const proceed = window.confirm('Зміна мови очистить розрахунки. Продовжити?');
        if (!proceed) { close(); return; }
        try { resetAllUI(); } catch {}
        window.__orbitSessionActive = false;
        window.dispatchEvent(new CustomEvent('orbit:session-end'));
      }

      try { setLanguage(lang); } catch {}
try { localStorage.setItem('orbit:lang', lang); } catch {}
cur.textContent = lang.toUpperCase();
close();

    });

    // Події сесії
    window.addEventListener('orbit:session-start', () => {
      window.__orbitSessionActive = true;
      menu.classList.remove('lang-free');
      menu.classList.add('lang-locked');
    });

    // Використовуємо існуючу подію повного скидання як "кінець сесії"
    window.addEventListener('orbit:ui-reset', () => {
      window.__orbitSessionActive = false;
      menu.classList.remove('lang-locked');
      menu.classList.add('lang-free');
      syncButton();
    });

    // Початковий стан
    if (window.__orbitSessionActive) {
      menu.classList.add('lang-locked');
    } else {
      menu.classList.add('lang-free');
    }
  });
})();
