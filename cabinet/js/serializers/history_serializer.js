// /cabinet/js/serializers/history_serializer.js
// Серіалізатор режиму «Історія» (SNAPSHOT-FIRST).
// ПРАВИЛО: зберігаємо лише те, що вже є в пам’яті сесії після «Розрахувати».
// О1 — один об’єкт зі snapshot і власним baselineDiameterMeters.
// О2 — масив об’єктів зі snapshot.
// ЖОДНИХ пошуків у бібліотеках і ЖОДНИХ фолбеків до селекторів.

import { getCurrentLang } from '/js/i18n.js';

(function registerHistorySerializer() {
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

  /* ───────── валідація snapshot ─────────
     Обов’язково: value, unit, id, category_key.
     Додатково (якщо присутні): value2 має мати unit2_key.
  ──────────────────────────────────────── */
  function isValidSnapshot(s) {
  if (!s || typeof s !== 'object') return false;

  // start: дозволяємо будь-яке скінченне число (у т.ч. 0/від’ємні роки)
  const v1 = Number(s.value ?? s.year ?? s.time_start?.value);
  if (!Number.isFinite(v1)) return false;

  // unit для років може бути відсутній або 'year'/'years'
  const u1 = String(s.unit ?? s.unit_key ?? s.time_start?.unit ?? '').trim().toLowerCase();
  if (u1 && u1 !== 'year' && u1 !== 'years') return false;

  // id та category_key обов’язкові (ідентифікація об’єкта)
  if (!s.id) return false;
  if (!('category_key' in s)) return false;

  // end: опційно; якщо є — має бути числом; unit2 може бути відсутній або 'year'/'years'
  if (s.value2 != null || s.year_end != null || (s.time_end && s.time_end.value != null)) {
    const v2 = Number(s.value2 ?? s.year_end ?? s.time_end?.value);
    if (!Number.isFinite(v2)) return false;
    const u2 = String(s.unit2 ?? s.unit2_key ?? s.time_end?.unit ?? '').trim().toLowerCase();
    if (u2 && u2 !== 'year' && u2 !== 'years') return false;
  }
  return true;
}


  /* ───────── читання з буферів сесії (БЕЗ фолбеків) ───────── */

  function readO1FromBuffer() {
    try {
      if (typeof window?.orbit?.getHistorySelectedO1 === 'function') {
        const x = window.orbit.getHistorySelectedO1();
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
      if (typeof window?.orbit?.getHistorySelectedO2s === 'function') {
        const arr = window.orbit.getHistorySelectedO2s();
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

  const serializer = function serializeHistoryScene() {
    // baseline керує масштабним колом; читаємо числове значення
    const baselineMeters = readNumberOrNull('historyBaselineDiameter');

    // Читаємо БЕЗПОСЕРЕДНЬО з буферів сесії (після «Розрахувати»)
    const o1  = readO1FromBuffer();
    const o2s = readO2ArrayFromBuffer();

    // Мінімальні умови: валідний О1 (зі snapshot) і принаймні один О2 (зі snapshot)
    if (!o1 || !o2s.length) {
      console.warn('[history_serializer] Потрібні валідні О1 і принаймні один О2 зі snapshot. Виконайте «Розрахувати».');
      return null;
    }

    const scene = {
      version: 2,
      lang: (typeof getCurrentLang === 'function' ? getCurrentLang() : 'en') || 'en',
      mode: 'history',
      center: getCenterOrNull(),
      history: {
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
