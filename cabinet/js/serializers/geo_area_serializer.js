// /cabinet/js/serializers/geo_area_serializer.js
// Серіалізатор режиму «Географія → Площа» з підтримкою масиву О2 (o2s).
// Працює незалежно від порядку завантаження: якщо місток ще не готовий — стає в чергу.

import { getCurrentLang } from '/js/i18n.js';

(function registerGeoAreaSerializer() {
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
      if (typeof window?.orbit?.getGeoAreaSelectedO2s === 'function') {
        const fromState = window.orbit.getGeoAreaSelectedO2s();
        if (!Array.isArray(fromState)) {
          console.warn('[geo_area_serializer] getGeoAreaSelectedO2s() must return array; got:', typeof fromState);
        } else {
          const norm = fromState.map(normO2).filter(Boolean);
          if (norm.length) return norm;
        }
      }
    } catch (err) {
      console.warn('[geo_area_serializer] Error reading O2 from state:', err);
    }

    // Фолбек: поточний вибір у випадайках → масив із 1 елемента або порожній
    const cat2 = readSelectInfo('geoAreaCategoryObject2');
    const obj2 = readSelectInfo('geoAreaObject2');
    const one = normO2({ categoryKey: cat2.value, objectId: obj2.value, name: obj2.label });
    return one ? [one] : [];
  }

  // ---------- serializer ----------
  const serializer = function serializeGeoAreaScene() {
    // О1
    const cat1 = readSelectInfo('geoAreaCategoryObject1');
    const obj1 = readSelectInfo('geoAreaObject1');
    const baselineMeters = readNumberOrNull('geoAreaBaselineDiameter');

    // О2 (масив)
    const o2s = readO2Array();

    // Мінімальна валідність: має бути О1 та хоча б один О2
    if (!obj1.value || o2s.length === 0) {
      console.warn('[geo_area_serializer] Incomplete data: need O1 and at least one O2');
      return null;
    }

    // Сцена
    const scene = {
      version: 2,
      lang: getCurrentLang?.() || 'en',
      mode: 'geo_area',
      center: getCenterOrNull(),
      geo_area: {
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
      window.orbit.registerSceneSerializer('geo_area', serializer);
    } else {
      (window.__orbit_pending_serializers__ ||= []).push({
        mode: 'geo_area',
        fn: serializer
      });
    }
  } catch (e) {
    console.error('[geo_area_serializer] register failed:', e);
  }
})();
