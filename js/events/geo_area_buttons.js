// /js/events/geo_area_buttons.js
'use strict';

/**
 * Обробник «Географія → Площа» — за еталоном «Населення» (SNAPSHOT-FIRST).
 * - О1: фіксуємо snapshot з вибраного option, baseline-діаметр масштабує кола.
 * - О2: додаємо результат, пишемо в буфер тільки те, що на екрані (SNAPSHOT-FIRST).
 * - Серіалізатор читає буфери через window.orbit.* геттери.
 *
 * Публічні геттери:
 *  - window.orbit.getGeoAreaSelectedO1()  -> { categoryKey, objectId, name, snapshot } | null
 *  - window.orbit.getGeoAreaSelectedO2s() -> [ { categoryKey, objectId, name, snapshot }, ... ]
 */

import { getGeoAreaData } from '../data/data_geo_area.js';
import { setGeoAreaBaseline, addGeoAreaCircle, resetGeoAreaScale } from '../calc/calculate_geo_area.js';
import { addGroup, appendVariant, setGroupDescription, setModeLabelKeys } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import { addGeodesicCircle, setCircleLabelTextById } from '../globe/circles.js';

/* ───────────────────────── helpers ───────────────────────── */

const norm = s => String(s ?? '').trim();

function getSelect(scope, id) {
  const root = scope || document;
  const el = root.querySelector(`#${id}`);
  return (el && el.tagName === 'SELECT') ? el : null;
}
function getVal(scope, sel) {
  const root = scope || document;
  const el = root.querySelector(sel);
  return el ? norm(el.value) : '';
}
function getSelectedOption(scope, selectId) {
  const sel = getSelect(scope, selectId);
  if (!sel) return null;
  const idx = sel.selectedIndex;
  if (idx < 0) return null;
  return sel.options[idx] || null;
}
/** Перевірка snapshot: value>0 і є unit */
function parseOptionSnapshot(opt) {
  try {
    const raw = opt?.dataset?.snapshot;
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    const v = Number(s.value);
    if (!Number.isFinite(v) || v <= 0) return null;
    if (!s.unit) return null;
    return s;
  } catch { return null; }
}

/* ─────────────────────── session state ───────────────────── */

let geoAreaResultSeq = 0;
let __isRepaint = false;

const __geoAreaSelectedO2s = [];
let __geoAreaSelectedO1 = null;

function __resetSelectedO2s() { __geoAreaSelectedO2s.length = 0; }
function __resetSelectedO1()  { __geoAreaSelectedO1 = null; }

function __readO2SnapshotFromDOM(scope) {
  const opt = getSelectedOption(scope, 'geoAreaObject2');
  return parseOptionSnapshot(opt);
}

function __setSelectedO1FromDOM(scope) {
  const opt = getSelectedOption(scope, 'geoAreaObject1');
  if (!opt) return;
  const snap = parseOptionSnapshot(opt);
  if (!snap) return;

  const catKeySel = getVal(scope, '#geoAreaCategoryObject1, .object1-group .category-select') || '';
  const objectId  = String(snap?.id ?? getVal(scope, '#geoAreaObject1, .object1-group .object-select') ?? '').trim();
  const name      = String(opt.textContent || '').trim() || null;
  const categoryKey = String(snap.category_key ?? catKeySel).trim();

  if (!categoryKey || !objectId) return;
  __geoAreaSelectedO1 = { categoryKey, objectId, name, snapshot: snap };
}

function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim() || null;

    // ID: пріоритет snapshot.id, далі userId/objectId/назва
    const snap = __readO2SnapshotFromDOM(item?.__scope);
    const objectId = String(
      snap?.id ?? item?.object2?.userId ?? item?.object2?.objectId ?? item?.object2?.name ?? ''
    ).trim();

    if (!categoryKey || !objectId || !snap) return;
    __geoAreaSelectedO2s.push({ categoryKey, objectId, name, snapshot: snap });
  } catch {}
}

/* ─────────────── expose getters for serializer ───────────── */

try {
  (window.orbit ||= {});
  window.orbit.getGeoAreaSelectedO1  = () => (__geoAreaSelectedO1 ? { ...__geoAreaSelectedO1 } : null);
  window.orbit.getGeoAreaSelectedO2s = () => __geoAreaSelectedO2s.map(x => ({ ...x }));
} catch {}

/* ─────────────────────── global events ───────────────────── */

try {
  window.addEventListener('orbit:ui-reset', () => {
    geoAreaResultSeq = 0;
    __resetSelectedO1();
    __resetSelectedO2s();
  });
  window.addEventListener('orbit:repaint-start', () => { __isRepaint = true;  });
  window.addEventListener('orbit:repaint-end',   () => { __isRepaint = false; });
} catch {}

/* ─────────────────────── main handler ────────────────────── */

/**
 * onGeoAreaCalculate({ scope })
 * - читає дані з адаптера;
 * - ставить baseline (О1);
 * - додає результат О2;
 * - пише О1/О2 зі snapshot у буфери (лише якщо це не repaint).
 */
export function onGeoAreaCalculate({ scope }) {
  // Етикетки режиму
  setModeLabelKeys({ modeKey: 'panel_title_geo', subKey: 'panel_title_geo_area' });

  // 1) Дані
  const data = getGeoAreaData(scope);

  // 1a) Зафіксувати О1 у буфер (snapshot-first), якщо це не repaint
  if (!__isRepaint) {
    __setSelectedO1FromDOM(scope);
  }

  // Кольори
  const color1 = getColorForKey('geo_area:baseline');
  const color2 = getColorForKey(`geo_area:o2:${++geoAreaResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // м
  const a1 = Number(data?.object1?.valueReal);                         // реальна площа О1
  const u1 = data?.object1?.unit || 'km²';

  resetGeoAreaScale();
  setGeoAreaBaseline({
    valueReal: a1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'geo_area_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline
  const o1RealOk = Number.isFinite(a1) && a1 > 0;
  if (!__isRepaint) {
    addGroup({
      id: 'geo_area_o1',
      title: data?.object1?.name || '',
      color: color1,
      groupType: 'baseline',
      uiLeftLabelKey:  'ui.geo.area.o1.left',
      uiRightLabelKey: 'ui.geo.area.o1.right'
    });
    appendVariant({
      id: 'geo_area_o1',
      variant: 'single',
      realValue: o1RealOk ? a1 : null,
      realUnit:  o1RealOk ? u1 : null,
      scaledMeters: baselineDiameter
    });
    if (String(data?.object1?.description || '').trim()) {
      setGroupDescription({ id: 'geo_area_o1', description: data.object1.description });
    }
  }

  // ——— START SESSION  ———
  const baselineValid = o1RealOk && (baselineDiameter > 0);
  if (baselineValid && scope) {
    // LOCK O1 UI
    const o1Group = scope.querySelector('.object1-group');
    if (o1Group) {
      o1Group.classList.add('is-locked');
      o1Group.querySelectorAll('select, input, button, textarea').forEach(el => { el.disabled = true; });
    }

    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}

    // — маркер центру кіл: один раз, тихо (як у «Населення»)
    (async () => {
      try {
        const { markerLayer, defaultCenterLon, defaultCenterLat } = await import('/js/globe/globe.js');
        const { placeMarker } = await import('/js/globe/markers.js');

        const ents = markerLayer.getEntities?.() || [];
        if (!ents.length) {
          placeMarker(defaultCenterLon, defaultCenterLat, { silent: true, suppressEvent: true });
        }
      } catch (e) {
        console.warn('[geo_area] center marker skipped:', e);
      }
    })();
  }

  // 3) О2 через калькулятор
  const a2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || 'km²';
  const res = addGeoAreaCircle({ valueReal: a2, unit: u2, color: color2 });

  // 3a) Коло О2
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `geo_area_r${geoAreaResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 3b) Інфопанель для О2
  const o2RealOk = Number.isFinite(a2) && a2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

  const groupId = `geo_area_o2_${geoAreaResultSeq}`;
  if (!__isRepaint) {
    addGroup({
      id: groupId,
      title: data?.object2?.name || '',
      color: color2,
      groupType: 'item',
      uiLeftLabelKey:  'ui.geo.area.o1.left',
      uiRightLabelKey: 'ui.geo.area.o1.right',
      invisibleReason: res?.tooLarge ? 'tooLarge' : null,
      requiredBaselineMeters: res?.requiredBaselineMeters ?? null
    });
    appendVariant({
      id: groupId,
      variant: 'single',
      realValue: o2RealOk ? a2 : null,
      realUnit:  o2RealOk ? u2 : null,
      scaledMeters: scaledDiameterMeters
    });
    if (String(data?.object2?.description || '').trim()) {
      setGroupDescription({ id: groupId, description: data.object2.description });
    }
  }

  // 4) Записати О2 у буфер (SNAPSHOT-FIRST) — тільки якщо не repaint
  if (!__isRepaint) {
    const snap2 = __readO2SnapshotFromDOM(scope);
    if (snap2) {
      __pushSelectedO2({ object2: data?.object2, __scope: scope });
    }
  }

  // 5) Лог
  // eslint-disable-next-line no-console
  console.log(
    '[mode:geo:area] D1=%sm; A1=%s%s; A2=%s%s → D2=%sm',
    baselineDiameter,
    o1RealOk ? a1.toLocaleString() : '—', o1RealOk ? u1 : '',
    o2RealOk ? a2.toLocaleString() : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
