// /cabinet/js/serializers/geo_population_serializer.js
// Серіалізатор режиму «Географія → Населення» (SNAPSHOT-FIRST).
// ПРАВИЛО: зберігаємо лише те, що вже є в пам’яті сесії після «Розрахувати».
// О1 — один об’єкт зі snapshot і власним baselineDiameterMeters.
// О2 — масив об’єктів зі snapshot.
// ЖОДНИХ пошуків у бібліотеках і ЖОДНИХ фолбеків до селекторів.

import { getCurrentLang } from '/js/i18n.js';

(function registerGeoPopulationSerializer() {
  'use strict';

  /* ───────── helpers: DOM / orbit ───────── */

  function getCenterOrNull() {
    try {
      const c = window?.orbit?.getCenter?.();
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) {
        return { lat: c.lat, lon: c.lon };
      }
    } catch {}
    return null;
  }

  function readNumberOrNull(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return null;
    const n = Number(String(el.value ?? '').replace(',', '.').trim());
    return Number.isFinite(n) ? n : null;
  }

  /* ───────── валідація snapshot ───────── */

  function isValidSnapshot(s) {
    if (!s || typeof s !== 'object') return false;
    const v = Number(s.value);
    if (!Number.isFinite(v) || v <= 0) return false;
    if (!s.unit) return false;
    if (!s.id) return false;
    if (!('category_key' in s)) return false;
    return true;
  }

  /* ───────── читання з буферів сесії (БЕЗ фолбеків) ───────── */

  function readO1FromBuffer() {
    try {
      if (typeof window?.orbit?.getGeoPopulationSelectedO1 === 'function') {
        const x = window.orbit.getGeoPopulationSelectedO1();
        if (!x || typeof x !== 'object') return null;

        const categoryKey = x?.categoryKey ?? x?.category ?? null;
        const objectId    = x?.objectId ?? x?.id ?? null;
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
      if (typeof window?.orbit?.getGeoPopulationSelectedO2s === 'function') {
        const arr = window.orbit.getGeoPopulationSelectedO2s();
        if (Array.isArray(arr)) {
          return arr.map(x => {
            const categoryKey = x?.categoryKey ?? x?.category ?? null;
            const objectId    = x?.objectId ?? x?.id ?? null;
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

  /* ───────── основний серіалізатор ───────── */

  const serializer = function serializeGeoPopulationScene() {
    // baseline керує масштабним колом; читаємо числове значення
    const baselineMeters = readNumberOrNull('geoPopBaselineDiameter');

    // Читаємо БЕЗПОСЕРЕДНЬО з буферів сесії (після «Розрахувати»)
    const o1  = readO1FromBuffer();
    const o2s = readO2ArrayFromBuffer();

    // Мінімальні умови: валідний О1 (зі snapshot) і принаймні один О2 (зі snapshot)
    if (!o1 || !o2s.length) {
      console.warn('[geo_population_serializer] Потрібні валідні О1 і принаймні один О2 зі snapshot. Виконайте «Розрахувати».');
      return null;
    }

    const scene = {
      version: 2,
      lang: (typeof getCurrentLang === 'function' ? getCurrentLang() : 'en') || 'en',
      mode: 'geo_population',
      center: getCenterOrNull(),
      geo_population: {
        o1: {
          ...o1,
          baselineDiameterMeters: baselineMeters
        },
        o2s
      }
    };

    return scene;
  };

  /* ───────── реєстрація ───────── */

  try {
    if (window?.orbit?.registerSceneSerializer) {
      window.orbit.registerSceneSerializer('geo_population', serializer);
    } else {
      (window.__orbit_pending_serializers__ ||= []).push({
        mode: 'geo_population',
        fn: serializer
      });
    }
  } catch (e) {
    console.error('[geo_population_serializer] register failed:', e);
  }
})();
