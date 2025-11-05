// /js/events/diameter_buttons.js
'use strict';

/**
 * Події режиму «Діаметри» — за еталоном «Відстань» (О2), з особливістю:
 *  - О1 так само має snapshot і фіксує baseline;
 *  - Під час «Розрахувати» записуємо в буфер тільки те, що на екрані (SNAPSHOT-FIRST);
 *  - Серіалізатор читає буфери через window.orbit.* геттери.
 *
 * Публічні геттери:
 *  - window.orbit.getUniversDiameterSelectedO1()  -> { categoryKey, objectId, name, snapshot }
 *  - window.orbit.getUniversDiameterSelectedO2s() -> [ { categoryKey, objectId, name, snapshot }, ... ]
 */

import { getDiameterData } from '../data/data_diameter.js';
import { setDiameterBaseline, addDiameterCircle, resetDiameterScale } from '../calc/calculate_diameter.js';
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

let diameterResultSeq = 0;
let __isRepaint = false;

const __diameterSelectedO2s = [];
let __diameterSelectedO1 = null;

function __resetSelectedO2s() { __diameterSelectedO2s.length = 0; }
function __resetSelectedO1()  { __diameterSelectedO1 = null; }

function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim() || null;

    // ID: перевага snapshot.id, далі userId/objectId/назва
    const snap = __readO2SnapshotFromDOM(item?.__scope);
    const objectId =
      String(snap?.id ?? item?.object2?.userId ?? item?.object2?.objectId ?? item?.object2?.name ?? '').trim();

    if (!categoryKey || !objectId || !snap) return;
    __diameterSelectedO2s.push({ categoryKey, objectId, name, snapshot: snap });
  } catch {}
}

function __setSelectedO1FromDOM(scope) {
  const opt = getSelectedOption(scope, 'diamObject1');
  if (!opt) return;
  const snap = parseOptionSnapshot(opt);
  if (!snap) return;

  const catKeySel = getVal(scope, '#diamCategoryObject1, .object1-group .category-select') || '';
  const objectId = String(snap?.id ?? getVal(scope, '#diamObject1, .object1-group .object-select') ?? '').trim();
  const name      = String(opt.textContent || '').trim() || null;
  const categoryKey = String(snap.category_key ?? catKeySel).trim();

  if (!categoryKey || !objectId) return;
  __diameterSelectedO1 = { categoryKey, objectId, name, snapshot: snap };
}

function __readO2SnapshotFromDOM(scope) {
  const opt = getSelectedOption(scope, 'diamObject2');
  return parseOptionSnapshot(opt);
}

/* ─────────────── expose getters for serializer ───────────── */

try {
  (window.orbit ||= {});
  window.orbit.getUniversDiameterSelectedO1  = () => (__diameterSelectedO1 ? { ...__diameterSelectedO1 } : null);
  window.orbit.getUniversDiameterSelectedO2s = () => __diameterSelectedO2s.map(x => ({ ...x }));
} catch {}

/* ─────────────────────── global events ───────────────────── */

try {
  window.addEventListener('orbit:ui-reset', () => {
    diameterResultSeq = 0;
    __resetSelectedO1();
    __resetSelectedO2s();
  });
  window.addEventListener('orbit:repaint-start', () => { __isRepaint = true;  });
  window.addEventListener('orbit:repaint-end',   () => { __isRepaint = false; });
} catch {}

/* ─────────────────────── main handler ────────────────────── */

/**
 * onDiameterCalculate({ scope })
 * - читає дані з адаптера;
 * - ставить baseline (О1);
 * - додає результат О2;
 * - пише О1/О2 зі snapshot у буфери (лише якщо це не repaint).
 */
export function onDiameterCalculate({ scope }) {
  // Етикетки режиму
  setModeLabelKeys({ modeKey: 'panel_title_univers', subKey: 'panel_title_univers_diameter' });

  // 1) Дані
  const data = getDiameterData(scope);

  // 1a) Зафіксувати О1 (snapshot-first) у буфер, якщо це не repaint
  if (!__isRepaint) {
    __setSelectedO1FromDOM(scope);
  }

  // Кольори
  const color1 = getColorForKey('diameter:baseline');
  const color2 = getColorForKey(`diameter:o2:${++diameterResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // D1 (м)
  const v1 = Number(data?.object1?.diameterReal);                      // реальний діаметр О1 (м)
  const u1 = data?.object1?.unit || 'm';

  resetDiameterScale();
  setDiameterBaseline({
    diameterReal: v1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'diameter_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline
  const o1RealOk = Number.isFinite(v1) && v1 > 0;
  if (!__isRepaint) {
    addGroup({
      id: 'diameter_o1',
      title: data?.object1?.name || '',
      color: color1,
      groupType: 'baseline',
      uiLeftLabelKey:  'diameter.labels.o1.left',
      uiRightLabelKey: 'diameter.labels.o1.right'
    });
    appendVariant({
      id: 'diameter_o1',
      variant: 'single',
      realValue: o1RealOk ? v1 : null,
      realUnit:  o1RealOk ? u1 : null,
      scaledMeters: baselineDiameter
    });
    if (String(data?.object1?.description || '').trim()) {
      setGroupDescription({ id: 'diameter_o1', description: data.object1.description });
    }
  }
  // ——— START SESSION  ———
  const baselineValid = (Number.isFinite(v1) && v1 > 0) && (baselineDiameter > 0);
  if (baselineValid && scope) {
    // LOCK O1 UI 
const o1Group = scope.querySelector('.object1-group');
if (o1Group) {
  o1Group.classList.add('is-locked');
  o1Group.querySelectorAll('select, input, button, textarea').forEach(el => {
    el.disabled = true;
  });
}

    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}
    
    // — маркер центру кіл: один раз, тихо
    (async () => {
      try {
        const { markerLayer, defaultCenterLon, defaultCenterLat } = await import('/js/globe/globe.js');
        const { placeMarker } = await import('/js/globe/markers.js');

        const ents = markerLayer.getEntities?.() || [];
        if (!ents.length) {
          placeMarker(defaultCenterLon, defaultCenterLat, { silent: true, suppressEvent: true });
        }
      } catch (e) {
        console.warn('[calculate] center marker skipped:', e);
      }
    })();
  }

  // 3) О2 через калькулятор
  const v2 = Number(data?.object2?.diameterReal);
  const u2 = data?.object2?.unit || 'm';
  const res = addDiameterCircle({
    diameterReal: v2,
    unit: u2,
    color: color2
  });

  // 3a) Коло О2
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `diameter_r${diameterResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 3b) Інфопанель для О2
  const o2RealOk = Number.isFinite(v2) && v2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

  const groupId = `diameter_o2_${diameterResultSeq}`;
  if (!__isRepaint) {
    addGroup({
      id: groupId,
      title: data?.object2?.name || '',
      color: color2,
      groupType: 'item',
    });
    appendVariant({
      id: groupId,
      variant: 'single',
      realValue: o2RealOk ? v2 : null,
      realUnit:  o2RealOk ? u2 : null,
      scaledMeters: scaledDiameterMeters,
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
    '[mode:diameter] O1: Dreal=%s %s → Dscaled=%s m; O2: Dreal=%s %s → Dscaled=%s m',
    o1RealOk ? v1 : '—', o1RealOk ? u1 : '-',
    baselineDiameter,
    o2RealOk ? v2 : '—', o2RealOk ? u2 : '-',
    scaledDiameterMeters
  );
}
