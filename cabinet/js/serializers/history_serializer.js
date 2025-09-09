// /cabinet/js/serializers/history_serializer.js
// Серіалізатор режиму «Історія» з підтримкою масиву О2 (history.o2s).
// Працює незалежно від порядку завантаження: якщо місток ще не готовий — стає в чергу.

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

  // Уніфікація одного елемента О2
  function normO2(x) {
    if (!x) return null;
    const categoryKey = (x.categoryKey ?? x.category ?? null);
    const objectId    = (x.objectId ?? x.id ?? null);
    const name        = (x.name ?? x.label ?? null);
    if (!categoryKey || !objectId) return null;
    return {
      categoryKey: String(categoryKey),
      objectId: String(objectId),
      name: name ? String(name) : null
    };
  }

  // Масив О2: спершу офіційний стан, інакше — фолбек на поточні селекти (1 елемент)
  function readO2Array() {
    try {
      if (typeof window?.orbit?.getHistorySelectedO2s === 'function') {
        const fromState = window.orbit.getHistorySelectedO2s();
        if (!Array.isArray(fromState)) {
          console.warn('[history_serializer] getHistorySelectedO2s() must return array; got:', typeof fromState);
        } else {
          const norm = fromState.map(normO2).filter(Boolean);
          if (norm.length) return norm;
        }
      }
    } catch (err) {
      console.warn('[history_serializer] Error reading O2 from state:', err);
    }

    // Фолбек: поточний вибір у випадайках → масив із 1 елемента або порожній
    const cat2 = readSelectInfo('histCategoryObject2');
    const obj2 = readSelectInfo('histObject2');
    const one = normO2({ categoryKey: cat2.value, objectId: obj2.value, name: obj2.label });
    return one ? [one] : [];
  }

  // ---------- serializer ----------
  const serializer = function serializeHistoryScene() {
    // О1
    const cat1 = readSelectInfo('histCategoryObject1');
    const obj1 = readSelectInfo('histObject1');
    const baselineMeters = readNumberOrNull('historyBaselineDiameter');

    // О2 (масив)
    const o2s = readO2Array();

    // Мінімальна валідність: має бути О1 та хоча б один О2
    if (!obj1.value || o2s.length === 0) {
      console.warn('[history_serializer] Incomplete data: need O1 and at least one O2');
      return null;
    }

    // Сцена
    const scene = {
      version: 2,                               // формат із масивом o2s
      lang: getCurrentLang?.() || 'en',
      mode: 'history',
      center: getCenterOrNull(),                // {lat, lon} або null
      history: {
        o1: {
          categoryKey: cat1.value,
          name: obj1.label,
          objectId: obj1.value,
          baselineDiameterMeters: baselineMeters
        },
        o2s                                      // новий масив усіх О2
      }
    };

    // Увага: legacy-поле history.o2 більше НЕ додаємо (щоб не було плутанини).

    return scene;
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
