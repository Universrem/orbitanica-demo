// main.js
// ─────────────────────────────────────────────────────────────
// Підключає глобус, ініціалізує сайдбар і керує перемикачем мов.

import { globus }              from './js/globe-main.js';
import { initSidebar }         from './js/sidebar.js';
import { setLanguage, getCurrentLang } from './js/i18n.js';

// 0. Оновлюємо розмір канви при зміні вікна
window.addEventListener('resize', () => {
  // Повідомляємо рендереру OpenGlobus про нові розміри
  globus.planet.renderer.resize();
});

// 1. Запускаємо сайдбар (малює кнопки порівнянь).
initSidebar();

// 2. Перемикач мов
const langButtons = document.querySelectorAll('#lang-switch .lang-option');

/**
 * Підсвічує активну кнопку мови.
 * @param {string} lang - 'ua' | 'en' | 'es'
 */
function highlightActive(lang) {
  langButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

// 2.1. Навішуємо обробники кліку.
langButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    setLanguage(btn.dataset.lang);            // змінюємо мову
  });
});

// 2.2. Підсвічуємо кнопку при першому завантаженні сторінки.
highlightActive(getCurrentLang());

// 2.3. Оновлюємо підсвічування після кожного перемикання мови.
document.addEventListener('languageChanged', e => {
  highlightActive(e.detail);                  // e.detail містить код мови
});












