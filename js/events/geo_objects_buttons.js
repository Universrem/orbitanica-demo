// /js/events/geo_objects_buttons.js
'use strict';

/**
 * Обробник для «Географія → Об’єкти (довжина/висота)» за еталоном «Математика» (SNAPSHOT-FIRST):
 *  - О1 так само має snapshot і фіксує baseline;
 *  - під час «Старт/Розрахувати» записуємо в буфери тільки те, що на екрані (SNAPSHOT-FIRST);
 *  - серіалізатор читає буфери через window.orbit.* геттери.
 *
 * Публічні геттери:
 *  - window.orbit.getGeoObjectsSelectedO1()  -> { categoryKey, objectId, name, snapshot } | null
 *  - window.orbit.getGeoObjectsSelectedO2s() -> [ { categoryKey, objectId, name, snapshot }, ... ]
 */

import { getGeoObjectsData } from '../data/data_geo_objects.js';
import { setGeoObjectsBaseline, addGeoObjectsCircle, resetGeoObjectsScale } from '../calc/calculate_geo_objects.js';
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

let geoObjectsResultSeq = 0;
let __isRepaint = false;

const __geoSelectedO2s = [];
let __geoSelectedO1 = null;

function __resetSelectedO2s() { __geoSelectedO2s.length = 0; }
function __resetSelectedO1()  { __geoSelectedO1 = null; }

function __readO2SnapshotFromDOM(scope) {
  const opt = getSelectedOption(scope, 'geoObjObject2');
  return parseOptionSnapshot(opt);
}
function __setSelectedO1FromDOM(scope) {
  const opt = getSelectedOption(scope, 'geoObjObject1');
  if (!opt) return;
  const snap = parseOptionSnapshot(opt);
  if (!snap) return;

  const catKeySel = getVal(scope, '#geoObjCategoryObject1, .object1-group .category-select') || '';
  const objectId  = String(snap?.id ?? getVal(scope, '#geoObjObject1, .object1-group .object-select') ?? '').trim();
  const name      = String(opt.textContent || '').trim() || null;
  const categoryKey = String(snap.category_key ?? catKeySel).trim();

  if (!categoryKey || !objectId) return;
  __geoSelectedO1 = { categoryKey, objectId, name, snapshot: snap };
}
function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim() || null;

    const snap = __readO2SnapshotFromDOM(item?.__scope);
    const objectId =
      String(snap?.id ?? item?.object2?.userId ?? item?.object2?.objectId ?? item?.object2?.name ?? '').trim();

    if (!categoryKey || !objectId || !snap) return;
    __geoSelectedO2s.push({ categoryKey, objectId, name, snapshot: snap });
  } catch {}
}

/* ─────────────── expose getters for serializer ───────────── */

try {
  (window.orbit ||= {});
  window.orbit.getGeoObjectsSelectedO1  = () => (__geoSelectedO1 ? { ...__geoSelectedO1 } : null);
  window.orbit.getGeoObjectsSelectedO2s = () => __geoSelectedO2s.map(x => ({ ...x }));
} catch {}

/* ─────────────────────── global events ───────────────────── */

try {
  window.addEventListener('orbit:ui-reset', () => {
    geoObjectsResultSeq = 0;
    __resetSelectedO1();
    __resetSelectedO2s();
  });
  window.addEventListener('orbit:repaint-start', () => { __isRepaint = true;  });
  window.addEventListener('orbit:repaint-end',   () => { __isRepaint = false; });
} catch {}

/* ─────────────────────── main handler ────────────────────── */

/**
 * onGeoObjectsCalculate({ scope })
 * - читає дані з адаптера;
 * - ставить baseline (О1);
 * - додає результат О2;
 * - пише О1/О2 зі snapshot у буфери (лише якщо це не repaint).
 */
export function onGeoObjectsCalculate({ scope }) {
  // Підпис інфопанелі: «Географія: Об’єкти»
  setModeLabelKeys({ modeKey: 'panel_title_geo', subKey: 'panel_title_geo_objects' });

  // 1) Дані
  const data = getGeoObjectsData(scope);

  // 1a) Зафіксувати О1 (snapshot-first) у буфер, якщо це не repaint
  if (!__isRepaint) {
    __setSelectedO1FromDOM(scope);
  }

  // Кольори
  const color1 = getColorForKey('geo_objects:baseline');
  const color2 = getColorForKey(`geo_objects:o2:${++geoObjectsResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // D1 (м)
  const baselineRadius   = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const v1 = Number(data?.object1?.valueReal);                         // реальна довжина/висота О1 (м)
  const u1Raw = data?.object1?.unit || 'm';
  const u1 = u1Raw && u1Raw.toLowerCase() !== 'm' ? u1Raw : 'm';

  resetGeoObjectsScale();
  setGeoObjectsBaseline({
    valueReal: v1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло
  const baselineId = 'geo_objects_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline (не під час repaint)
  const o1RealOk = Number.isFinite(v1) && v1 > 0;
  if (!__isRepaint) {
    addGroup({
      id: 'geo_objects_o1',
      title: data?.object1?.name || '',
      color: color1,
      groupType: 'baseline',
      uiLeftLabelKey:  'ui.geo.objects.o1.left',
      uiRightLabelKey: 'ui.geo.objects.o1.right',
    });
    appendVariant({
      id: 'geo_objects_o1',
      variant: 'single',
      realValue: o1RealOk ? v1 : null,
      realUnit:  o1RealOk ? u1 : null,
      // У цьому підрежимі scaledMeters в інфопанелі — РАДІУС
      scaledMeters: baselineRadius
    });
    if (String(data?.object1?.description || '').trim()) {
      setGroupDescription({ id: 'geo_objects_o1', description: data.object1.description });
    }
  }

  // ——— START SESSION / LOCK O1 UI ———
  const baselineValid = o1RealOk && baselineRadius > 0;
  if (baselineValid && scope) {
    const o1Group = scope.querySelector('.object1-group');
    if (o1Group) {
      o1Group.classList.add('is-locked');
      o1Group.querySelectorAll('select, input, button, textarea').forEach(el => { el.disabled = true; });
    }
    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}
  }

  // 3) О2 через калькулятор
  const v2 = Number(data?.object2?.valueReal);
  const u2Raw = data?.object2?.unit || 'm';
  const u2 = u2Raw && u2Raw.toLowerCase() !== 'm' ? u2Raw : 'm';

  const res = addGeoObjectsCircle({
    valueReal: v2,
    unit: u2,
    color: color2
  });

  // 3a) Коло О2
  const scaledRadiusMeters = res && Number(res.scaledRadiusMeters) > 0
    ? Number(res.scaledRadiusMeters)
    : 0;

  if (scaledRadiusMeters > 0) {
    const id = addGeodesicCircle(scaledRadiusMeters, color2, `geo_objects_r${geoObjectsResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 3b) Інфопанель для О2 (не під час repaint)
  const o2RealOk = Number.isFinite(v2) && v2 > 0;
  const groupId = `geo_objects_o2_${geoObjectsResultSeq}`;
  if (!__isRepaint) {
    addGroup({
      id: groupId,
      title: data?.object2?.name || '',
      color: color2,
      groupType: 'item',
      uiLeftLabelKey:  'ui.geo.objects.o1.left',
      uiRightLabelKey: 'ui.geo.objects.o1.right',
    });
    appendVariant({
      id: groupId,
      variant: 'single',
      realValue: o2RealOk ? v2 : null,
      realUnit:  o2RealOk ? u2 : null,
      scaledMeters: scaledRadiusMeters,
      invisibleReason: res?.tooLarge ? 'tooLarge' : null,
      requiredBaselineMeters: res?.requiredBaselineMeters ?? null
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
    '[mode:geo:objects] O1: L=%s%s → Rscaled=%s; O2: L=%s%s → Rscaled=%s',
    o1RealOk ? v1 : '—', o1RealOk ? ` ${u1}` : '',
    baselineRadius,
    o2RealOk ? v2 : '—', o2RealOk ? ` ${u2}` : '',
    scaledRadiusMeters
  );
}
