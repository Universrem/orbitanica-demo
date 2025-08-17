// full/js/i18n.js
'use strict';

// Підтримувані мови
const SUPPORTED_LANGS = ['ua', 'en', 'es'];

// Стан i18n
let translations = {};
let currentLang = 'ua';
let __inited = false;

// ─────────────────────────────────────────────────────────────
// ПУБЛІЧНИЙ API

/**
 * Ініціалізація i18n: завантажує словник, визначає мову, оновлює статичні тексти,
 * надсилає події languageChanged / orbit:lang-change.
 * Може безпечно викликатися кілька разів (працює як guard).
 */
export async function initI18n() {
  if (__inited) {
    // навіть якщо вже ініт, оновимо статичні тексти та повідомимо слухачів
    refreshStaticTexts();
    dispatchLangEvents(currentLang);
    return;
  }

  // 1) Завантаження словника
  try {
    const resp = await fetch('/full/data/translations.json');
    translations = await resp.json();
  } catch (err) {
    console.error('🌐 Не вдалося завантажити translations.json', err);
    translations = {};
  }

  // 2) Визначення мови: localStorage → браузер → 'ua'
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

  // 3) Підстановка текстів у DOM
  refreshStaticTexts();

  // 4) Зберегти вибір і повідомити слухачів (панель, інші модулі)
  try { localStorage.setItem('orbit:lang', currentLang); } catch {}
  dispatchLangEvents(currentLang);

  // 5) Активувати legacy-перемикачі, якщо присутні у DOM
  initLegacyFlagSwitchers();

  __inited = true;
}

/** Поточна мова */
export function getCurrentLang() {
  return currentLang;
}

/** Переклад ключа */
export function t(key) {
  if (!key) return '';
  const row = translations[key];
  if (!row) return key;
  return row[currentLang] || row.ua || key;
}

/**
 * Змінити мову інтерфейсу.
 * Оновлює статичні тексти, зберігає вибір, шле події для всіх модулів.
 */
export function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  if (lang === currentLang) return;

  currentLang = lang;
  try { localStorage.setItem('orbit:lang', lang); } catch {}

  refreshStaticTexts();
  dispatchLangEvents(lang);
  highlightLegacy(lang);
}

// ─────────────────────────────────────────────────────────────
// ДОПОМІЖНЕ

/** Оновлює всі елементи з атрибутом [data-i18n-key] */
function refreshStaticTexts() {
  try {
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
      const key = el.getAttribute('data-i18n-key');
      const translated = t(key);
      if (el.tagName === 'INPUT' && 'placeholder' in el) {
        el.placeholder = translated;
      } else {
        el.textContent = translated;
      }
    });
  } catch (e) {
    // тиха деградація, якщо DOM ще не готовий
  }
}

/** Розсилка подій зміни мови (нові/старі слухачі) */
function dispatchLangEvents(lang) {
  try {
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('orbit:lang-change', { detail: { lang } }));
  } catch {}
}

/** Ініціалізація legacy-перемикачів (прапорці .lang-option), якщо присутні */
function initLegacyFlagSwitchers() {
  try {
    document.querySelectorAll('.lang-option').forEach(el => {
      el.addEventListener('click', () => {
        const lang = el.getAttribute('data-lang');
        if (lang && lang !== getCurrentLang()) {
          setLanguage(lang);
        }
      });
    });
    highlightLegacy(currentLang);
  } catch {}
}

/** Підсвітка активної мови для legacy-перемикачів */
function highlightLegacy(lang) {
  try {
    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// АВТО-СТАРТ I18N (без підключення панелі)
// Якщо документ уже готовий — ініціалізуємось одразу; інакше — на DOMContentLoaded.
if (document.readyState !== 'loading') {
  // не блокуємо main.js, який може викликати initI18n ще раз — guard всередині
  initI18n();
} else {
  document.addEventListener('DOMContentLoaded', () => { initI18n(); }, { once: true });
}
