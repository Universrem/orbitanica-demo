// /cabinet/js/serializers/univers_luminosity_serializer.js
// Серіалізатор режиму «Universe → Luminosity» з підтримкою масиву О2 (o2s).
// Стає в чергу, якщо реєстратор ще не готовий.

import { getCurrentLang } from '/js/i18n.js';

(function registerUniversLuminositySerializer() {
  'use strict';

  // ---- helpers ----
  function getCenterOrNull() {
    try {
      const c = window?.orbit?.getCenter?.();
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) {
        return { lat: c.lat, lon: c.lon };
      }
    } catch {}
    return null;
  }

  function readSelectInfo(id) {
    const el = document.getElementById(id);
    if (!el || el.tagName !== 'SELECT') return { value: '', label: '' };
    const value = String(el.value || '');
    const label = String(el.options?.[el.selectedIndex]?.text || '');
    return { value, label };
  }

  function readNumber(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    const v = Number(el.value);
    return Number.isFinite(v) ? v : NaN;
  }

  function normO(obj) {
    const categoryKey = String(obj?.categoryKey || '').trim();
    const objectId    = String(obj?.objectId    || '').trim();
    const nameRaw     = obj?.name ?? obj?.label ?? null;
    if (!categoryKey || !objectId) return null;
    return {
      categoryKey,
      objectId,
      name: nameRaw != null ? String(nameRaw) : null
    };
  }

  // Масив О2: пріоритет — з буфера кнопок; фолбек — поточні селекти (1 шт)
  function readO2Array() {
    try {
      if (typeof window?.orbit?.getUniversLuminositySelectedO2s === 'function') {
        const fromState = window.orbit.getUniversLuminositySelectedO2s();
        if (Array.isArray(fromState)) {
          const norm = fromState.map(normO).filter(Boolean);
          if (norm.length) return norm;
        } else {
          console.warn('[univers_luminosity_serializer] getUniversLuminositySelectedO2s() must return array; got:', typeof fromState);
        }
      }
    } catch (err) {
      console.warn('[univers_luminosity_serializer] Error reading O2 from state:', err);
    }

    const cat2 = readSelectInfo('lumiCategoryObject2');
    const obj2 = readSelectInfo('lumiObject2');
    const one  = normO({ categoryKey: cat2.value, objectId: obj2.value, name: obj2.label });
    return one ? [one] : [];
  }

  // ---- serializer ----
  const serializer = () => {
    // O1 (у «Світності» два селектори)
    const cat1 = readSelectInfo('lumiCategoryObject1');
    const obj1 = readSelectInfo('lumiObject1');
    const o1   = normO({ categoryKey: cat1.value, objectId: obj1.value, name: obj1.label });

    // масштаб — діаметр кола для О1
    const baselineDiameterMeters = readNumber('lumiCircleObject1');

    // Якщо немає О1 або масштабу — сцена невалідна
    if (!o1 || !Number.isFinite(baselineDiameterMeters) || baselineDiameterMeters <= 0) {
      return null;
    }

    const scene = {
      mode: 'univers_luminosity',
      lang: typeof getCurrentLang === 'function' ? getCurrentLang() : null,
      center: getCenterOrNull(),
      univers_luminosity: {
        o1: {
          objectId: o1.objectId,
          name: o1.name,
          categoryKey: o1.categoryKey,
          baselineDiameterMeters: baselineDiameterMeters
        },
        o2s: readO2Array()
      }
    };

    return scene;
  };

  // ---- register / queue ----
  try {
    if (window?.orbit?.registerSceneSerializer) {
      window.orbit.registerSceneSerializer('univers_luminosity', serializer);
    } else {
      (window.__orbit_pending_serializers__ ||= []).push({
        mode: 'univers_luminosity',
        fn: serializer
      });
    }
  } catch (e) {
    console.error('[univers_luminosity_serializer] register failed:', e);
  }
})();
