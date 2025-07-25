// js/i18n.js
// ─────────────────────────────────────────────────────────────
// Центр керування мовами без імпорту JSON-модуля.
// Словник підтягується через fetch('../data/translations.json').

const SUPPORTED_LANGS = ['ua', 'en', 'es'];
let translations = {};          // сюди підвантажимо весь словник
let currentLang = 'ua';         // дефолт

// ─────────────────────────────────────────────────────────────
// 1. Підтягнути словник і ініціалізувати мову
initI18n();

async function initI18n() {
  try {
    translations = await fetch('./data/translations.json')
                           .then(r => r.json());

    // Читаємо вибір із localStorage
    const saved = localStorage.getItem('lang');
    if (SUPPORTED_LANGS.includes(saved)) currentLang = saved;

    refreshStaticTexts();   // підставити написи, щойно словник є
    document.dispatchEvent(new CustomEvent('languageChanged',
                                           { detail: currentLang }));
  } catch (err) {
    console.error('🌐 Не вдалося завантажити translations.json', err);
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Апі перекладу

/** Повертає переклад за ключем */
export function t(key) {
  const row = translations[key];
  if (!row) return key;                 // немає такого ключа
  return row[currentLang] || row.ua;    // запасний варіант – українська
}

/** Повертає поточну мову */
export function getCurrentLang() {
  return currentLang;
}

/** Змінює мову та сповіщає модулі */
export function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);

  refreshStaticTexts();
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
}

// ─────────────────────────────────────────────────────────────
// 3. Підміна текстів у статичному HTML

function refreshStaticTexts() {
  document.querySelectorAll('[data-i18n-key]').forEach(el => {
    const key = el.getAttribute('data-i18n-key');
    el.textContent = t(key);
  });
}

