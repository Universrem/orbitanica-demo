// Серіалізатор режиму «Universe → Distance» з масивом О2 (o2s[]).
// ЄДИНЕ ПРАВИЛО: зберігаємо лише те, що вже лежить у пам’яті сесії після «Розрахувати».
// Кожний О2 має містити повну копію даних (snapshot) всередині сцени.
// ЖОДНИХ пошуків у бібліотеках та жодних «фолбеків».

import { getCurrentLang } from '/js/i18n.js';

(function registerUniversDistanceSerializer() {
  'use strict';

  /* ───────────── helpers: DOM ───────────── */

  function readSelectInfo(selectId) {
    const el = document.getElementById(selectId);
    if (!el || el.tagName !== 'SELECT') return { value: null, label: null };
    const value = el.value ?? null;
    const opt = el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
    const label = (opt?.textContent || '').trim() || null;
    return { value: value || null, label };
  }

  function readNumberOrNull(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return null;
    const n = Number(String(el.value ?? '').replace(',', '.').trim());
    return Number.isFinite(n) ? n : null;
  }

  function getCenterOrNull() {
    try {
      const c = window?.orbit?.getCenter?.();
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) {
        return { lat: c.lat, lon: c.lon };
      }
    } catch {}
    return null;
  }

  /* ───────────── валідація «копії» (snapshot) ───────────── */

  function isValidSnapshot(s) {
    if (!s || typeof s !== 'object') return false;
    const v = Number(s.value);
    if (!Number.isFinite(v) || v <= 0) return false;
    if (!s.unit) return false;
    // ключові ідентифікатори
    if (!s.id) return false;
    if (!s.category_key && s.category_key !== 0) return false;
    return true;
  }

  /* ───────────── читання О2 з буфера сесії ───────────── */

  // Очікується, що кнопки режиму записують сюди О2 із snapshot під час кожного «Розрахувати»
  function readO2ArrayFromBuffer() {
    try {
      if (typeof window?.orbit?.getUniversDistanceSelectedO2s === 'function') {
        const arr = window.orbit.getUniversDistanceSelectedO2s();
        if (Array.isArray(arr)) {
          // нормалізуємо структуру і одразу фільтруємо невалідні
          return arr.map(x => {
            const categoryKey = x?.categoryKey ?? x?.category ?? null;
            const objectId    = x?.objectId ?? x?.id ?? null;
            const name        = x?.name ?? null;
            const snapshot    = x?.snapshot ?? null;

            return {
              categoryKey: categoryKey != null ? String(categoryKey) : null,
              objectId:    objectId    != null ? String(objectId)    : null,
              name:        name ? String(name) : null,
              snapshot:    snapshot
            };
          });
        }
      }
    } catch {}
    return [];
  }

  /* ───────────── основний серіалізатор ───────────── */

  const serializer = function serializeUniversDistanceScene() {
    // O1 (об’єкт 1)
    const obj1 = readSelectInfo('distObject1');
    const baselineMeters = readNumberOrNull('distCircleObject1');

    // Масив О2 беремо ТІЛЬКИ з буфера сесії
    const rawO2s = readO2ArrayFromBuffer();

    // Мінімальна валідність: потрібні О1 і хоча б один О2
    if (!obj1?.value || !rawO2s.length) {
      console.warn('[univers_distance_serializer] Немає достатніх даних: потрібні О1 і принаймні один О2.');
      return null;
    }

    // Кожний О2 повинен мати валідний snapshot
    const invalid = rawO2s.filter(x => !isValidSnapshot(x?.snapshot) || !x?.categoryKey || !x?.objectId);
    if (invalid.length) {
      console.warn('[univers_distance_serializer] Деякі О2 без повної копії даних. Додайте їх ще раз через «Розрахувати».');
      // За жорстким правилом — не зберігаємо сцену, щоб не створювати «биті» сцени
      return null;
    }

    // Сцена
    const scene = {
      version: 2,
      lang: (typeof getCurrentLang === 'function' ? getCurrentLang() : 'en') || 'en',
      mode: 'univers_distance',
      center: getCenterOrNull(),
      univers_distance: {
        o1: {
          categoryKey: null,                // за контрактом О1 без категорії
          name: obj1.label ?? null,
          objectId: obj1.value ?? null,
          baselineDiameterMeters: baselineMeters
        },
        // Без змін записуємо те, що зібрали кнопки: { categoryKey, objectId, name, snapshot }
        o2s: rawO2s
      }
    };

    return scene;
  };

  /* ───────────── реєстрація ───────────── */

  try {
    if (window?.orbit?.registerSceneSerializer) {
      window.orbit.registerSceneSerializer('univers_distance', serializer);
    } else {
      (window.__orbit_pending_serializers__ ||= []).push({
        mode: 'univers_distance',
        fn: serializer
      });
    }
  } catch (e) {
    console.error('[univers_distance_serializer] register failed:', e);
  }
})();
