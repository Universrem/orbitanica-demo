// /cabinet/js/serializers/history_serializer.js
// Серіалізатор режиму «Історія». Без залежності від порядку завантаження файлів:
// якщо місток (saveScene) ще не ініціалізований — кладемося в чергу.

import { getCurrentLang } from '/js/i18n.js';

(function registerHistorySerializer() {
  'use strict';

  // ---------- helpers ----------
  function getCenterOrNull() {
    try {
      const c = window?.orbit?.getCenter?.();
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) {
        return { lat: c.lat, lon: c.lon };
      }
    } catch (_) {}
    return null;
  }

  function readSelectInfo(selectId) {
    const el = document.getElementById(selectId);
    if (!el || el.tagName !== 'SELECT') return { value: null, label: null };
    const value = el.value ?? null;
    let label = null;
    try {
      const opt = el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
      label = (opt?.textContent || '').trim() || null;
    } catch (_) {}
    return { value: value || null, label };
  }

  function readNumberOrNull(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return null;
    const n = Number(String(el.value ?? '').replace(',', '.').trim());
    return Number.isFinite(n) ? n : null;
  }

  // ---------- serializer ----------
  const serializer = function serializeHistoryScene() {
    // Поточні вибори у формі режиму «Історія»
    const cat1 = readSelectInfo('histCategoryObject1');
    const obj1 = readSelectInfo('histObject1');
    const cat2 = readSelectInfo('histCategoryObject2');
    const obj2 = readSelectInfo('histObject2');

    // Базовий діаметр (метри) — задає масштаб сцени для О1
    const baselineMeters = readNumberOrNull('historyBaselineDiameter');

    // Мінімальний каркас сцени для БД
    return {
      version: 1,
      lang: getCurrentLang?.() || 'en',
      mode: 'history',
      center: getCenterOrNull(), // {lat, lon} або null
      history: {
        o1: {
          categoryKey: cat1.value,
          name: obj1.label,
          objectId: obj1.value,
          baselineDiameterMeters: baselineMeters
        },
        o2: {
          categoryKey: cat2.value,
          name: obj2.label,
          objectId: obj2.value
        }
      }
    };
  };

  // ---------- реєстрація / черга ----------
  try {
    if (window?.orbit?.registerSceneSerializer) {
      window.orbit.registerSceneSerializer('history', serializer);
    } else {
      (window.__orbit_pending_serializers__ ||= []).push({
        mode: 'history',
        fn: serializer
      });
    }
  } catch (e) {
    console.error('[history_serializer] register failed:', e);
  }
})();
