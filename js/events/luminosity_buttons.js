// full/js/events/luminosity_buttons.js
'use strict';

/**
 * Події режиму «Світність» — за еталоном «Діаметри» (snapshot-first).
 *  - О1 має snapshot і фіксує baseline;
 *  - під час «Розрахувати» пишемо в буфер тільки те, що на екрані;
 *  - серіалізатор читає буфери через window.orbit.* геттери.
 *
 * Публічні геттери:
 *  - window.orbit.getUniversLuminositySelectedO1()  -> { categoryKey, objectId, name, snapshot }
 *  - window.orbit.getUniversLuminositySelectedO2s() -> [ { categoryKey, objectId, name, snapshot }, ... ]
 */

import { getLuminosityData } from '../data/data_luminosity.js';
import { setLuminosityBaseline, addLuminosityCircle, resetLuminosityScale } from '../calc/calculate_luminosity.js';
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

let luminosityResultSeq = 0;
let __isRepaint = false;

const __luminositySelectedO2s = [];
let __luminositySelectedO1 = null;

function __resetSelectedO2s() { __luminositySelectedO2s.length = 0; }
function __resetSelectedO1()  { __luminositySelectedO1 = null; }

function __readO2SnapshotFromDOM(scope) {
  const opt = getSelectedOption(scope, 'lumiObject2');
  return parseOptionSnapshot(opt);
}

function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim() || null;

    // ID: перевага snapshot.id, далі userId/objectId/назва
    const snap = __readO2SnapshotFromDOM(item?.__scope);
    const objectId =
      String(snap?.id ?? item?.object2?.userId ?? item?.object2?.objectId ?? item?.object2?.name ?? '').trim();

    if (!categoryKey || !objectId || !snap) return;
    __luminositySelectedO2s.push({ categoryKey, objectId, name, snapshot: snap });
  } catch {}
}

function __setSelectedO1FromDOM(scope) {
  const opt = getSelectedOption(scope, 'lumiObject1');
  if (!opt) return;
  const snap = parseOptionSnapshot(opt);
  if (!snap) return;

  const catKeySel = getVal(scope, '#lumiCategoryObject1, .object1-group .category-select') || '';
  const objectId  = String(snap?.id ?? getVal(scope, '#lumiObject1, .object1-group .object-select') ?? '').trim();
  const name      = String(opt.textContent || '').trim() || null;
  const categoryKey = String(snap.category_key ?? catKeySel).trim();

  if (!categoryKey || !objectId) return;
  __luminositySelectedO1 = { categoryKey, objectId, name, snapshot: snap };
}

/* ─────────────── expose getters for serializer ───────────── */

try {
  (window.orbit ||= {});
  window.orbit.getUniversLuminositySelectedO1  = () => (__luminositySelectedO1 ? { ...__luminositySelectedO1 } : null);
  window.orbit.getUniversLuminositySelectedO2s = () => __luminositySelectedO2s.map(x => ({ ...x }));
} catch {}

/* ─────────────────────── global events ───────────────────── */

try {
  window.addEventListener('orbit:ui-reset', () => {
    luminosityResultSeq = 0;
    __resetSelectedO1();
    __resetSelectedO2s();
  });
  window.addEventListener('orbit:repaint-start', () => { __isRepaint = true;  });
  window.addEventListener('orbit:repaint-end',   () => { __isRepaint = false; });
} catch {}

/* ─────────────────────── main handler ────────────────────── */

/**
 * onLuminosityCalculate({ scope })
 * - читає дані з адаптера;
 * - ставить baseline (О1);
 * - додає результат О2;
 * - пише О1/О2 зі snapshot у буфери (лише якщо це не repaint).
 */
export function onLuminosityCalculate({ scope }) {
  // Етикетки режиму
  setModeLabelKeys({ modeKey: 'panel_title_univers', subKey: 'panel_title_univers_luminosity' });

  // 1) Дані
  const data = getLuminosityData(scope);

  // 1a) Зафіксувати О1 (snapshot-first) у буфер, якщо це не repaint
  if (!__isRepaint) {
    __setSelectedO1FromDOM(scope);
  }

  // Кольори
  const color1 = getColorForKey('luminosity:baseline');
  const color2 = getColorForKey(`luminosity:o2:${++luminosityResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // діаметр кола на мапі (м)
  const l1 = Number(data?.object1?.valueReal);                         // реальна світність (Вт)
  const u1 = data?.object1?.unit || 'W';

  resetLuminosityScale();
  setLuminosityBaseline({
    valueReal: l1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'luminosity_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline
  const o1RealOk = Number.isFinite(l1) && l1 > 0;
  if (!__isRepaint) {
    addGroup({
      id: 'luminosity_o1',
      title: data?.object1?.name || '',
      color: color1,
      groupType: 'baseline',
      uiLeftLabelKey:  'luminosity.labels.o1.left',   // "Luminosity"
      uiRightLabelKey: 'luminosity.labels.o1.right'   // "Scaled diameter"
    });
    appendVariant({
      id: 'luminosity_o1',
      variant: 'single',
      realValue: o1RealOk ? l1 : null,
      realUnit:  o1RealOk ? u1 : null,
      // у світності також показуємо масштабований ДІАМЕТР (м)
      scaledMeters: baselineDiameter
    });
    if (String(data?.object1?.description || '').trim()) {
      setGroupDescription({ id: 'luminosity_o1', description: data.object1.description });
    }
  }
  // ——— START SESSION  ———
  const baselineValid = (Number.isFinite(l1) && l1 > 0) && (baselineDiameter > 0);
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
  }

  // 3) О2 через калькулятор
  const l2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || 'W';
  const res = addLuminosityCircle({
    valueReal: l2,
    unit: u2,
    color: color2
  });

  // 3a) Коло О2
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `luminosity_r${luminosityResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 3b) Інфопанель для О2
  const o2RealOk = Number.isFinite(l2) && l2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

  const groupId = `luminosity_o2_${luminosityResultSeq}`;
  if (!__isRepaint) {
    addGroup({
      id: groupId,
      title: data?.object2?.name || '',
      color: color2,
      groupType: 'item',
      uiLeftLabelKey:  'luminosity.labels.o1.left',
      uiRightLabelKey: 'luminosity.labels.o1.right',
      invisibleReason: res?.tooLarge ? 'tooLarge' : null,
      requiredBaselineMeters: res?.requiredBaselineMeters ?? null
    });
    appendVariant({
      id: groupId,
      variant: 'single',
      realValue: o2RealOk ? l2 : null,
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
    '[mode:luminosity] O1: Lreal=%s %s → Dscaled=%s m; O2: Lreal=%s %s → Dscaled=%s m',
    o1RealOk ? l1 : '—', o1RealOk ? u1 : '-',
    baselineDiameter,
    o2RealOk ? l2 : '—', o2RealOk ? u2 : '-',
    scaledDiameterMeters
  );
}
