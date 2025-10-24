// /cabinet/js/serializers/univers_distance_serializer.js
// Серіалізатор режиму «Universe → Distance» з підтримкою масиву O2 (o2s[])
// Формує snapshot для кожного O2 з єдиної бібліотеки (офіційні + юзерські).
// ПІДТРИМКА: якщо аплайєр прикріпив snapshot у dataset option'а О2 — беремо його напряму.

import { getCurrentLang } from '/js/i18n.js';
import { getUniversLibrary, loadUniversLibrary, resolveObject } from '/js/data/univers_lib.js';

(function registerUniversDistanceSerializer() {
  'use strict';

  // Ініціюємо завантаження бібліотеки наперед (асинхронно, без очікування).
  try { loadUniversLibrary('distance'); } catch {}

  /* ───────────── helpers: DOM ───────────── */

  function readSelectInfo(selectId) {
    const el = document.getElementById(selectId);
    if (!el || el.tagName !== 'SELECT') return { value: null, label: null, option: null };
    const value = el.value ?? null;
    const opt = el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
    const label = (opt?.textContent || '').trim() || null;
    return { value: value || null, label, option: opt || null };
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

  /* ───────────── helpers: строки/порівняння ───────────── */

  const norm = (s) => String(s ?? '').trim();
  const low  = (s) => norm(s).toLowerCase();

  function sameText(a, b) {
    if (a == null || b == null) return false;
    return low(a) === low(b);
  }

  function anyNameEquals(rec, name) {
    if (!name || !rec) return false;
    return (
      sameText(rec.name_en, name) ||
      sameText(rec.name_ua, name) ||
      sameText(rec.name_es, name) ||
      sameText(rec.name,    name)
    );
  }

  function anyCategoryEquals(rec, categoryLabel) {
    if (!categoryLabel || !rec) return false;
    // Порівнюємо з людськими назвами категорій (локалізовані).
    return (
      sameText(rec.category_en, categoryLabel) ||
      sameText(rec.category_ua, categoryLabel) ||
      sameText(rec.category_es, categoryLabel) ||
      sameText(rec.category,    categoryLabel)
    );
  }

  /* ───────────── бібліотека: пошук O2 ───────────── */

  function getDistanceLibrary() {
    const arr = getUniversLibrary('distance');
    return Array.isArray(arr) ? arr : [];
  }

  /**
   * Пошук запису в бібліотеці для побудови snapshot.
   * Пріоритет: id → (name + category_key) → (name + category label) → name.
   * Якщо доступний resolveObject() — використовуємо його.
   */
  function findRecordForO2({ id, name, categoryKey, categoryLabel }) {
    const lib = getDistanceLibrary();
    if (!lib.length) return null;

    // 0) Спробувати універсальний резолвер
    try {
      if (typeof resolveObject === 'function') {
        const r = resolveObject('distance', { id, name, category_key: categoryKey });
        if (r) return r;
      }
    } catch {}

    // 1) За UUID
    if (id) {
      const byId = lib.find(r => r?.id && String(r.id) === String(id));
      if (byId) return byId;
    }

    // 2) За (name + category_key)
    if (name && categoryKey) {
      const byNameAndKey = lib.find(r =>
        anyNameEquals(r, name) && sameText(r?.category_key || r?.category_id, categoryKey)
      );
      if (byNameAndKey) return byNameAndKey;
    }

    // 3) За (name + локалізована категорія)
    if (name && categoryLabel) {
      const byNameAndCatLabel = lib.find(r =>
        anyNameEquals(r, name) && anyCategoryEquals(r, categoryLabel)
      );
      if (byNameAndCatLabel) return byNameAndCatLabel;
    }

    // 4) Фолбек: лише за назвою
    if (name) {
      const byName = lib.find(r => anyNameEquals(r, name));
      if (byName) return byName;
    }

    return null;
  }

  /**
   * Формує snapshot з запису бібліотеки.
   * Важливо: у сцені зберігаємо саме `category_key`.
   */
  function buildSnapshotFromRecord(rec) {
    if (!rec) return null;
    const m = rec?.distance_to_earth;
    const value = Number(m?.value);
    const unit  = m?.unit ?? null;
    if (!Number.isFinite(value) || value <= 0) return null;

    return {
      id: rec?.id ?? null,
      category_key: rec?.category_key ?? rec?.category_id ?? null,
      value,
      unit: unit ?? null,
      name_ua: rec?.name_ua ?? null,
      name_en: rec?.name_en ?? null,
      name_es: rec?.name_es ?? null,
      description_ua: rec?.description_ua ?? null,
      description_en: rec?.description_en ?? null,
      description_es: rec?.description_es ?? null,
    };
  }

  /* ───────────── читання O2 з UI/стану ───────────── */

  // Якщо аплайєр прикріпив snapshot у dataset option'а О2 — зчитаємо його.
  function readSnapshotFromSelectedOption(opt) {
    if (!opt || !opt.dataset) return null;
    const raw = opt.dataset.snapshot;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      // мінімальна валідація
      const v = Number(parsed?.value);
      if (!Number.isFinite(v) || v <= 0) return null;
      return {
        id: parsed?.id ?? null,
        category_key: parsed?.category_key ?? null,
        value: v,
        unit: parsed?.unit ?? null,
        name_ua: parsed?.name_ua ?? null,
        name_en: parsed?.name_en ?? null,
        name_es: parsed?.name_es ?? null,
        description_ua: parsed?.description_ua ?? null,
        description_en: parsed?.description_en ?? null,
        description_es: parsed?.description_es ?? null,
      };
    } catch {
      return null;
    }
  }

  function readO2FromStateOrUI() {
    // 1) Офіційний масив O2 з ядра (якщо є)
    try {
      if (typeof window?.orbit?.getUniversDistanceSelectedO2s === 'function') {
        const arr = window.orbit.getUniversDistanceSelectedO2s();
        if (Array.isArray(arr) && arr.length) {
          return arr.map((x) => {
            const categoryKey   = x?.categoryKey ?? x?.category_key ?? null;
            const categoryLabel = x?.category ?? x?.categoryLabel ?? null;
            const objectId      = x?.objectId ?? x?.id ?? null;
            const name          = x?.name ?? x?.label ?? null;
            // у цьому гіллі dataset.snapshot недоступний — заповнимо пізніше через бібліотеку
            return {
              categoryKey: categoryKey ? String(categoryKey) : null,
              categoryLabel: categoryLabel ? String(categoryLabel) : null,
              objectId: objectId ? String(objectId) : null,
              name: name ? String(name) : null,
              snapshot: null,
            };
          }).filter(it => it.name || it.objectId);
        }
      }
    } catch {}

    // 2) Фолбек — пара селекторів (категорія/об'єкт) + snapshot з option.dataset (якщо є)
    const cat2 = readSelectInfo('distCategoryObject2');
    const obj2 = readSelectInfo('distObject2');

    const snapFromDataset = readSnapshotFromSelectedOption(obj2.option);

    const one = {
      categoryKey: cat2?.value ? String(cat2.value) : null,
      categoryLabel: cat2?.label ? String(cat2.label) : null,
      objectId: obj2?.value ? String(obj2.value) : null,
      name: obj2?.label ? String(obj2.label) : null,
      snapshot: snapFromDataset, // якщо присутній — беремо напряму
    };

    return (one.name || one.objectId) ? [one] : [];
  }

  function enrichO2WithSnapshot(items) {
    if (!Array.isArray(items) || !items.length) return [];
    return items.map((o2) => {
      // 1) Якщо вже маємо валідний snapshot (із dataset) — лишаємо як є
      if (o2.snapshot && Number.isFinite(Number(o2.snapshot.value))) {
        return {
          categoryKey: o2.categoryKey ?? null,
          objectId: o2.objectId ?? null,
          name: o2.name ?? null,
          snapshot: o2.snapshot,
        };
      }
      // 2) Інакше пробуємо знайти в бібліотеці
      const rec = findRecordForO2({
        id: o2.objectId,
        name: o2.name,
        categoryKey: o2.categoryKey,
        categoryLabel: o2.categoryLabel,
      });
      const snapshot = buildSnapshotFromRecord(rec);
      return {
        categoryKey: o2.categoryKey ?? null,
        objectId: o2.objectId ?? null,
        name: o2.name ?? null,
        snapshot: snapshot ?? null,
      };
    });
  }

  /* ───────────── основний серіалізатор ───────────── */

  const serializer = function serializeUniversDistanceScene() {
    // O1
    const obj1 = readSelectInfo('distObject1');
    const baselineMeters = readNumberOrNull('distCircleObject1');

    // O2
    const rawO2s = readO2FromStateOrUI();
    const o2s = enrichO2WithSnapshot(rawO2s);

    // Мінімальна валідність
    if (!obj1?.value || !o2s.length) {
      console.warn('[univers_distance_serializer] Incomplete: need O1 and at least one O2');
      return null;
    }

    const scene = {
      version: 2,
      lang: (typeof getCurrentLang === 'function' ? getCurrentLang() : 'en') || 'en',
      mode: 'univers_distance',
      center: getCenterOrNull(),
      univers_distance: {
        o1: {
          // O1 без категорії (null за контрактом)
          categoryKey: null,
          name: obj1.label ?? null,
          objectId: obj1.value ?? null,
          baselineDiameterMeters: baselineMeters,
        },
        o2s,
      },
    };

    // Діагностика
    if (o2s.some(x => !x.snapshot)) {
      console.warn('[univers_distance_serializer] Some O2 lack snapshot — ensure univers_lib is loaded or applier attached dataset snapshot.');
    }

    return scene;
  };

  /* ───────────── реєстрація ───────────── */

  try {
    if (window?.orbit?.registerSceneSerializer) {
      window.orbit.registerSceneSerializer('univers_distance', serializer);
    } else {
      (window.__orbit_pending_serializers__ ||= []).push({
        mode: 'univers_distance',
        fn: serializer,
      });
    }
  } catch (e) {
    console.error('[univers_distance_serializer] register failed:', e);
  }
})();
