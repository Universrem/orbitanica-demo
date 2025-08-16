// full/js/i18n.js
import { initLeftPanel } from './panel.js';

const SUPPORTED_LANGS = ['ua', 'en', 'es'];
let translations = {};
let currentLang = 'ua';

// ─────────────────────────────────────────────────────────────
// 1) Ініціалізація
document.addEventListener('DOMContentLoaded', initI18n);

async function initI18n() {
  try {
    translations = await fetch('/full/data/translations.json').then(r => r.json());
  } catch (err) {
    console.error('🌐 Не вдалося завантажити translations.json', err);
    translations = {};
  }

  // Пріоритет: localStorage ('orbit:lang' → 'lang') → браузер → 'ua'
  let saved = null;
  try {
    saved = localStorage.getItem('orbit:lang') || localStorage.getItem('lang') || null;
  } catch {}

  if (saved && SUPPORTED_LANGS.includes(saved)) {
    currentLang = saved;
  } else {
    const nav = (navigator.language || navigator.userLanguage || 'uk').toLowerCase();
    if (nav.startsWith('uk')) currentLang = 'ua';
    else if (nav.startsWith('en')) currentLang = 'en';
    else if (nav.startsWith('es')) currentLang = 'es';
    else currentLang = 'ua';
  }

  // Підставляємо переклади, ініціалізуємо ліву панель
  refreshStaticTexts();
  try { initLeftPanel(); } catch {}

  // Синхронізація з UI (обидві події — для сумісності)
  try { localStorage.setItem('orbit:lang', currentLang); } catch {}
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: currentLang }));
  window.dispatchEvent(new CustomEvent('orbit:lang-change', { detail: { lang: currentLang } }));

  // Активувати legacy-перемикачі, якщо присутні
  initLegacyFlagSwitchers();
}

// ─────────────────────────────────────────────────────────────
// 2) API перекладу

export function t(key) {
  const row = translations[key];
  if (!row) return key;
  return row[currentLang] || row.ua || key;
}

export function getCurrentLang() {
  return currentLang;
}

export function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  if (lang === currentLang) return;

  currentLang = lang;
  try { localStorage.setItem('orbit:lang', lang); } catch {}

  refreshStaticTexts();

  // Події для всіх частин UI (сумісність зі старими/новими слухачами)
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
  window.dispatchEvent(new CustomEvent('orbit:lang-change', { detail: { lang } }));

  // Оновити підсвітку у legacy-перемикачів (якщо є)
  highlightLegacy(lang);
}

// ─────────────────────────────────────────────────────────────
// 3) Підстановка тексту для всіх [data-i18n-key]

function refreshStaticTexts() {
  document.querySelectorAll('[data-i18n-key]').forEach(el => {
    const key = el.getAttribute('data-i18n-key');
    const translated = t(key);
    if (el.tagName === 'INPUT' && 'placeholder' in el) {
      el.placeholder = translated;
    } else {
      el.textContent = translated;
    }
  });
}

// ─────────────────────────────────────────────────────────────
// 4) Legacy-перемикачі (прапорці .lang-option)

function initLegacyFlagSwitchers() {
  document.querySelectorAll('.lang-option').forEach(el => {
    el.addEventListener('click', () => {
      const lang = el.getAttribute('data-lang');
      if (lang && lang !== getCurrentLang()) {
        setLanguage(lang);
      }
    });
  });
  highlightLegacy(currentLang);
}

function highlightLegacy(lang) {
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });
}

