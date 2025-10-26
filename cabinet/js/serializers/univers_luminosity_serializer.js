// /cabinet/js/serializers/univers_luminosity_serializer.js
// Серіалізатор режиму «Universe → Luminosity» (SNAPSHOT-FIRST).
// ПРАВИЛО: зберігаємо лише те, що вже є в пам’яті сесії після «Розрахувати».
// О1 — один об’єкт зі snapshot і власним baselineDiameterMeters (#lumiCircleObject1).
// О2 — масив об’єктів зі snapshot.
// ЖОДНИХ пошуків у бібліотеках і ЖОДНИХ фолбеків до селекторів.

import { getCurrentLang } from '/js/i18n.js';

(function registerUniversLuminositySerializer() {
  'use strict';

  // ───────── helpers
  function getCenterOrNull() {
    try {
      const c = window?.orbit?.getCenter?.();
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) return { lat: c.lat, lon: c.lon };
    } catch {}
    return null;
  }

  function readNumberOrNull(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return null;
    const n = Number(String(el.value ?? '').replace(',', '.').trim());
    return Number.isFinite(n) ? n : null;
  }

  // ───────── snapshot validation
  function isValidSnapshot(s) {
    if (!s || typeof s !== 'object') return false;
    const v = Number(s.value);
    if (!Number.isFinite(v) || v <= 0) return false;
    if (!s.unit) return false;
    if (!s.id) return false;
    if (!('category_key' in s)) return false;
    return true;
  }

  // ───────── read from session buffers (NO fallbacks)
  function readO1FromBuffer() {
    try {
      if (typeof window?.orbit?.getUniversLuminositySelectedO1 === 'function') {
        const x = window.orbit.getUniversLuminositySelectedO1();
        if (!x || typeof x !== 'object') return null;

        const categoryKey = x?.categoryKey ?? x?.category ?? null;
        const objectId    = x?.objectId    ?? x?.id       ?? null;
        const name        = x?.name ?? null;
        const snapshot    = x?.snapshot ?? null;

        if (!categoryKey || !objectId || !isValidSnapshot(snapshot)) return null;

        return {
          categoryKey: String(categoryKey),
          objectId: String(objectId),
          name: name ? String(name) : null,
          snapshot
        };
      }
    } catch {}
    return null;
  }

  function readO2ArrayFromBuffer() {
    try {
      if (typeof window?.orbit?.getUniversLuminositySelectedO2s === 'function') {
        const arr = window.orbit.getUniversLuminositySelectedO2s();
        if (Array.isArray(arr)) {
          return arr.map(x => {
            const categoryKey = x?.categoryKey ?? x?.category ?? null;
            const objectId    = x?.objectId    ?? x?.id       ?? null;
            const name        = x?.name ?? null;
            const snapshot    = x?.snapshot ?? null;

            return (!categoryKey || !objectId || !isValidSnapshot(snapshot))
              ? null
              : {
                  categoryKey: String(categoryKey),
                  objectId: String(objectId),
                  name: name ? String(name) : null,
                  snapshot
                };
          }).filter(Boolean);
        }
      }
    } catch {}
    return [];
  }

  // ───────── serializer
  const serializer = function serializeUniversLuminosityScene() {
    // масштаб (діаметр базового кола в м) читаємо прямо з інпута
    const baselineMeters = readNumberOrNull('lumiCircleObject1');

    const o1  = readO1FromBuffer();
    const o2s = readO2ArrayFromBuffer();

    // Мінімальні умови: валідний О1 (зі snapshot), baseline, і принаймні один О2 (зі snapshot)
    if (!o1 || !o2s.length || !Number.isFinite(baselineMeters) || baselineMeters <= 0) {
      console.warn('[univers_luminosity_serializer] Потрібні валідні О1/О2 зі snapshot і базовий діаметр. Виконайте «Розрахувати».');
      return null;
    }

    return {
      version: 2,
      lang: (typeof getCurrentLang === 'function' ? getCurrentLang() : 'en') || 'en',
      mode: 'univers_luminosity',
      center: getCenterOrNull(),
      univers_luminosity: {
        o1: {
          ...o1,
          baselineDiameterMeters: baselineMeters
        },
        o2s
      }
    };
  };

  // ───────── register
  try {
    if (window?.orbit?.registerSceneSerializer) {
      window.orbit.registerSceneSerializer('univers_luminosity', serializer);
    } else {
      (window.__orbit_pending_serializers__ ||= []).push({ mode: 'univers_luminosity', fn: serializer });
    }
  } catch (e) {
    console.error('[univers_luminosity_serializer] register failed:', e);
  }
})();
