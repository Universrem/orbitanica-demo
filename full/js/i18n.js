// full/js/i18n.js
import { initLeftPanel } from './panel.js';

const SUPPORTED_LANGS = ['ua', 'en', 'es'];
let translations = {};
let currentLang = 'ua';

// 1. Завантаження словника та ініціалізація
document.addEventListener('DOMContentLoaded', initI18n);

async function initI18n() {
  try {
    // Завантажуємо словник перекладів
    translations = await fetch('/full/data/translations.json').then(r => r.json());

    // Читаємо збережену мову з localStorage
    const saved = localStorage.getItem('lang');
    if (SUPPORTED_LANGS.includes(saved)) currentLang = saved;

    // Підставляємо переклади одразу після завантаження
    refreshStaticTexts();
    initLeftPanel();
    document.dispatchEvent(new CustomEvent('languageChanged', {
      detail: currentLang
    }));
  } catch (err) {
    console.error('🌐 Не вдалося завантажити translations.json', err);
  }
}

// ─────────────────────────────────────────────────────────────
// 2. API для перекладу

/** Повертає переклад за ключем */
export function t(key) {
  const row = translations[key];
  if (!row) return key;
  return row[currentLang] || row.ua || key;
}

/** Повертає поточну мову */
export function getCurrentLang() {
  return currentLang;
}

/** Змінює мову та оновлює текст */
export function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);

  refreshStaticTexts();
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
}

// ─────────────────────────────────────────────────────────────
// 3. Підстановка тексту для всіх [data-i18n-key]

function refreshStaticTexts() {
  document.querySelectorAll('[data-i18n-key]').forEach(el => {
    const key = el.getAttribute('data-i18n-key');
    const translated = t(key);
    if (el.placeholder !== undefined && el.tagName === 'INPUT') {
      el.placeholder = translated;
    } else {
      el.textContent = translated;
    }
  });
}

// ─────────────────────────────────────────────────────────────
// 4. Перемикач мов (елементи .lang-option)

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lang-option').forEach(el => {
    el.addEventListener('click', () => {
      const lang = el.getAttribute('data-lang');
      if (lang && lang !== getCurrentLang()) {
        setLanguage(lang);

        // Підсвітка активної кнопки
        document.querySelectorAll('.lang-option').forEach(btn => {
          btn.classList.remove('active');
        });
        el.classList.add('active');
      }
    });
  });
});
