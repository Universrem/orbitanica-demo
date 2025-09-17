// /cabinet/js/serializers/money_serializer.js
// Серіалізатор режиму «Money» з підтримкою масиву О2 (o2s).
// Якщо місток ще не готовий — стає в чергу.

import { getCurrentLang } from '/js/i18n.js';

(function registerMoneySerializer() {
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
      if (typeof window?.orbit?.getMoneySelectedO2s === 'function') {
        const fromState = window.orbit.getMoneySelectedO2s();
        if (!Array.isArray(fromState)) {
          console.warn('[money_serializer] getMoneySelectedO2s() must return array; got:', typeof fromState);
        } else {
          const norm = fromState.map(normO2).filter(Boolean);
          if (norm.length) return norm;
        }
      }
    } catch (err) {
      console.warn('[money_serializer] Error reading O2 from state:', err);
    }

    // Фолбек: поточний вибір у випадайках → масив із 1 елемента або порожній
    const cat2 = readSelectInfo('moneyCategoryObject2');
    const obj2 = readSelectInfo('moneyObject2');
    const one = normO2({ categoryKey: cat2.value, objectId: obj2.value, name: obj2.label });
    return one ? [one] : [];
  }

  // ---------- serializer ----------
  const serializer = function serializeMoneyScene() {
    // О1
    const cat1 = readSelectInfo('moneyCategoryObject1');
    const obj1 = readSelectInfo('moneyObject1');
    const baselineMeters = readNumberOrNull('moneyBaselineDiameter');

    // О2 (масив)
    const o2s = readO2Array();

    // Мінімальна валідність
    if (!obj1.value || o2s.length === 0) {
      console.warn('[money_serializer] Incomplete data: need O1 and at least one O2');
      return null;
    }

    // Сцена
    const scene = {
      version: 2,
      lang: getCurrentLang?.() || 'en',
      mode: 'money',
      center: getCenterOrNull(),
      money: {
        o1: {
          categoryKey: cat1.value,
          name: obj1.label,
          objectId: obj1.value,
          baselineDiameterMeters: baselineMeters
        },
        o2s
      }
    };

    return scene;
  };

  // ---------- реєстрація / черга ----------
  try {
    if (window?.orbit?.registerSceneSerializer) {
      window.orbit.registerSceneSerializer('money', serializer);
    } else {
      (window.__orbit_pending_serializers__ ||= []).push({
        mode: 'money',
        fn: serializer
      });
    }
  } catch (e) {
    console.error('[money_serializer] register failed:', e);
  }
})();
