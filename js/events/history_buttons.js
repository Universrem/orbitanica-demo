// /js/events/history_buttons.js
'use strict';

/**
 * Обробник «Історія» — СТРОГО за еталоном «Географія → Населення» (SNAPSHOT-FIRST).
 * ЄДИНА різниця режиму: у об'єкта завжди є start (обов'язково), end — опційно.
 *
 * - О1: фіксуємо snapshot із вибраного <option> (value=start, unit='year', value2=end?),
 *       baseline-діаметр масштабує кола.
 * - О2: додаємо результат, пишемо в буфер тільки те, що на екрані (SNAPSHOT-FIRST).
 * - Серіалізатор читає буфери через window.orbit.* геттери.
 *
 * Публічні геттери:
 *  - window.orbit.getHistorySelectedO1()  -> { categoryKey, objectId, name, snapshot } | null
 *  - window.orbit.getHistorySelectedO2s() -> [ { categoryKey, objectId, name, snapshot }, ... ]
 *
 * Особливості рендера:
 *  - Масштаб лінійний по роках від pivotYear;
 *  - В інфопанелі передаємо РАДІУС (метри) як scaledMeters;
 *  - Лейбли кіл: start → "[ Назва", end → "Назва ]", single (лише один рік) → "— Назва" (для О1) або "Назва" (для О2).
 */

import { getHistoryData } from '../data/data_history.js';
import { setHistoryBaseline, addHistoryCircle, resetHistoryScale } from '../calc/calculate_history.js';
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

/** Перевірка snapshot для історії:
 *  - value (start) є числом (допускаємо ≤0/від'ємні роки як н.е./до н.е.);
 *  - unit/unit_key дорівнює 'year' (без чутливості до регістру);
 *  - value2/unit2_key (end) МОЖЕ бути відсутнім або валідним числом.
 */
function parseOptionSnapshot(opt) {
  try {
    const raw = opt?.dataset?.snapshot;
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;

    const v1 = Number(s.value ?? s.year ?? s.time_start?.value);
    if (!Number.isFinite(v1)) return null;

    const u1 = String(s.unit ?? s.unit_key ?? s.time_start?.unit ?? '').trim().toLowerCase();
    if (u1 && u1 !== 'year' && u1 !== 'years') return null;

    const v2 = s.value2 ?? s.year_end ?? s.time_end?.value;
    const u2 = String(s.unit2_key ?? s.time_end?.unit ?? '').trim().toLowerCase();
    const endOk = (v2 == null) || Number.isFinite(Number(v2));
    if (!endOk) return null;
    if (v2 != null && u2 && u2 !== 'year' && u2 !== 'years') return null;

    return s;
  } catch { return null; }
}

/* ─────────────────────── session state ───────────────────── */

let historyResultSeq = 0;
let __isRepaint = false;

const __historySelectedO2s = [];
let __historySelectedO1 = null;

function __resetSelectedO2s() { __historySelectedO2s.length = 0; }
function __resetSelectedO1()  { __historySelectedO1 = null; }

function __readO2SnapshotFromDOM(scope) {
  const opt = getSelectedOption(scope, 'histObject2');
  return parseOptionSnapshot(opt);
}

function __setSelectedO1FromDOM(scope) {
  const opt = getSelectedOption(scope, 'histObject1');
  if (!opt) return;
  const snap = parseOptionSnapshot(opt);
  if (!snap) return;

  const catKeySel = getVal(scope, '#histCategoryObject1, .object1-group .category-select') || '';
  const objectId  = String(snap?.id ?? getVal(scope, '#histObject1, .object1-group .object-select') ?? '').trim();
  const name      = String(opt.textContent || '').trim() || null;
  const categoryKey = String(snap.category_key ?? catKeySel).trim();

  if (!categoryKey || !objectId) return;
  __historySelectedO1 = { categoryKey, objectId, name, snapshot: snap };
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
    __historySelectedO2s.push({ categoryKey, objectId, name, snapshot: snap });
  } catch {}
}

/* ─────────────── expose getters for serializer ───────────── */

try {
  (window.orbit ||= {});
  window.orbit.getHistorySelectedO1  = () => (__historySelectedO1 ? { ...__historySelectedO1 } : null);
  window.orbit.getHistorySelectedO2s = () => __historySelectedO2s.map(x => ({ ...x }));
} catch {}

/* ─────────────────────── global events ───────────────────── */

try {
  window.addEventListener('orbit:ui-reset', () => {
    historyResultSeq = 0;
    __resetSelectedO1();
    __resetSelectedO2s();
  });
  window.addEventListener('orbit:repaint-start', () => { __isRepaint = true;  });
  window.addEventListener('orbit:repaint-end',   () => { __isRepaint = false; });
} catch {}

/* ─────────────────────── main handler ────────────────────── */

/**
 * onHistoryCalculate({ scope })
 * - читає дані з адаптера;
 * - ставить baseline (О1-start);
 * - додає О1-end (якщо є) та О2 (start/end/single);
 * - пише О1/О2 зі snapshot у буфери (лише якщо це не repaint).
 */
export function onHistoryCalculate({ scope }) {
  // Етикетки режиму
  setModeLabelKeys({ modeKey: 'panel_title_history' });

  // 1) Дані
  const data = getHistoryData(scope);

  // 1a) Зафіксувати О1 у буфер (snapshot-first), якщо це не repaint
  if (!__isRepaint) {
    __setSelectedO1FromDOM(scope);
  }

  const pivot = Number(data?.pivotYear) || (new Date()).getFullYear();

  // Кольори
  const color1 = getColorForKey('history:baseline');
  const color2 = getColorForKey(`history:o2:${++historyResultSeq}`);

  // Baseline
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // діаметр із UI (м)
  const baselineRadius   = baselineDiameter > 0 ? baselineDiameter / 2 : 0;

  const yearsStartO1 = data?.object1?.yearsStart; // |pivot - yearStart|
  const y1sValid = Number.isFinite(yearsStartO1) && yearsStartO1 >= 0;

  resetHistoryScale();
  setHistoryBaseline({
    yearsForScale: y1sValid ? yearsStartO1 : NaN,
    circleDiameterMeters: baselineDiameter,
    color: color1,
    pivotYear: pivot
  });

  // 2) О1-start коло
  const hasEnd1 = Number.isFinite(data?.object1?.yearEnd);
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, 'history_baseline');
    if (id) {
      const nm0 = String(data?.object1?.name || '').trim();
      if (nm0) setCircleLabelTextById(id, hasEnd1 ? `[ ${nm0}` : `— ${nm0}`);
    }
  }

  // 2b) Інфопанель: baseline (start або single)
  const y1_start = data?.object1?.yearStart;
  const y1_start_ok = Number.isFinite(y1_start);

  addGroup({
    id: 'history_o1',
    title: data?.object1?.name || '',
    color: color1,
    groupType: 'baseline',
    uiLeftLabelKey:  'history.labels.o1.left',
    uiRightLabelKey: 'history.labels.o1.right',
  });

  appendVariant({
    id: 'history_o1',
    variant: hasEnd1 ? 'start' : 'single',
    realValue: y1_start_ok ? y1_start : null,
    realUnit: 'рік',
    scaledMeters: baselineRadius
  });

  if (String(data?.object1?.description || '').trim()) {
    setGroupDescription({ id: 'history_o1', description: data.object1.description });
  }

  // 2c) Позначити pivot-рік (тонке коло біля центру), ідемпотентно
  if (baselineRadius > 0) {
    const EPS = 1e-9;
    const resC = addHistoryCircle({ year: pivot + EPS, pivotYear: pivot, color: color1 });
    if (resC && Number(resC?.scaledRadiusMeters) > 0) {
      const pid = addGeodesicCircle(resC.scaledRadiusMeters, color1, 'history_pivot');
      if (pid) setCircleLabelTextById(pid, String(pivot));
    }
  }

  // ——— LOCK O1 UI ДО RESET + START SESSION ———
  const baselineValid = y1sValid && baselineDiameter > 0;
  if (baselineValid && scope) {
    const o1group = scope.querySelector('.object1-group');
    if (o1group) {
      o1group.classList.add('is-locked');
      o1group.querySelectorAll('select, input, button, textarea').forEach(el => { el.disabled = true; });
    }
    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}
  }

  // 3) О1-end
  const y1_end = data?.object1?.yearEnd;
  let resEnd;
  if (Number.isFinite(y1_end)) {
    resEnd = addHistoryCircle({ year: y1_end, pivotYear: pivot, color: color1 });
    if (resEnd && Number(resEnd.scaledRadiusMeters) > 0) {
      const id = addGeodesicCircle(resEnd.scaledRadiusMeters, color1, 'history_o1_end');
      if (id) {
        const nm = String(data?.object1?.name || '').trim();
        if (nm) setCircleLabelTextById(id, `${nm} ]`);
      }
    }
    appendVariant({
      id: 'history_o1',
      variant: 'end',
      realValue: y1_end,
      realUnit: 'рік',
      scaledMeters: resEnd?.scaledRadiusMeters || 0,
      invisibleReason: resEnd?.tooLarge ? 'tooLarge' : null,
      requiredBaselineMeters: resEnd?.requiredBaselineMeters ?? null
    });
  }

  // 4) О2 (start/end/single)
  const o2name = String(data?.object2?.name || '').trim();
  const o2desc = String(data?.object2?.description || '').trim();

  const y2_start = data?.object2?.yearStart;
  const y2_end   = data?.object2?.yearEnd;
  const hasStart2 = Number.isFinite(y2_start);
  const hasEnd2   = Number.isFinite(y2_end);

  if (hasStart2 || hasEnd2 || o2name) {
    const groupId = `history_o2_${historyResultSeq}`;
    addGroup({
      id: groupId,
      title: o2name || '',
      color: color2,
      groupType: 'item',
      uiLeftLabelKey:  'history.labels.o1.left',
      uiRightLabelKey: 'history.labels.o1.right',
    });
    if (o2desc) setGroupDescription({ id: groupId, description: o2desc });

    // start / single
    let resS;
    if (hasStart2) {
      resS = addHistoryCircle({ year: y2_start, pivotYear: pivot, color: color2 });
      if (resS && Number(resS.scaledRadiusMeters) > 0) {
        const id = addGeodesicCircle(resS.scaledRadiusMeters, color2, `${groupId}_start`);
        if (id && o2name) setCircleLabelTextById(id, hasEnd2 ? `[ ${o2name}` : `${o2name}`);
      }
      appendVariant({
        id: groupId,
        variant: hasEnd2 ? 'start' : 'single',
        realValue: y2_start,
        realUnit: 'рік',
        scaledMeters: resS?.scaledRadiusMeters || 0,
        invisibleReason: resS?.tooLarge ? 'tooLarge' : null,
        requiredBaselineMeters: resS?.requiredBaselineMeters ?? null
      });
    }

    // end
    let resE;
    if (hasEnd2) {
      resE = addHistoryCircle({ year: y2_end, pivotYear: pivot, color: color2 });
      if (resE && Number(resE.scaledRadiusMeters) > 0) {
        const id = addGeodesicCircle(resE.scaledRadiusMeters, color2, `${groupId}_end`);
        if (id && o2name) setCircleLabelTextById(id, `${o2name} ]`);
      }
      appendVariant({
        id: groupId,
        variant: 'end',
        realValue: y2_end,
        realUnit: 'рік',
        scaledMeters: resE?.scaledRadiusMeters || 0,
        invisibleReason: resE?.tooLarge ? 'tooLarge' : null,
        requiredBaselineMeters: resE?.requiredBaselineMeters ?? null
      });
    }
  }

  // 5) Записати О2 у буфер (SNAPSHOT-FIRST) — тільки якщо не repaint
  if (!__isRepaint) {
    const snap2 = __readO2SnapshotFromDOM(scope);
    if (snap2) {
      __pushSelectedO2({ object2: data?.object2, __scope: scope });
    }
  }

  // 6) Лог
  // eslint-disable-next-line no-console
  console.log(
    '[mode:history] pivot=%s; O1: start=%s; end=%s; O2: start=%s; end=%s',
    pivot,
    Number.isFinite(data?.object1?.yearStart) ? data.object1.yearStart : '—',
    Number.isFinite(data?.object1?.yearEnd)   ? data.object1.yearEnd   : '—',
    Number.isFinite(data?.object2?.yearStart) ? data.object2.yearStart : '—',
    Number.isFinite(data?.object2?.yearEnd)   ? data.object2.yearEnd   : '—'
  );
}
