// /full/js/events/money_buttons.js
'use strict';

/**
 * Події режиму «Гроші» — snapshot-first, за еталоном «Діаметри».
 *  - О1 має snapshot і фіксує baseline (#moneyBaselineDiameter);
 *  - Під час «Розрахувати» пишемо в буфер лише те, що на екрані (SNAPSHOT-FIRST);
 *  - Серіалізатор читає буфери через window.orbit.* геттери.
 *
 * Публічні геттери:
 *  - window.orbit.getMoneySelectedO1()  -> { categoryKey, objectId, name, snapshot }
 *  - window.orbit.getMoneySelectedO2s() -> [ { categoryKey, objectId, name, snapshot }, ... ]
 */

import { getMoneyData } from '../data/data_money.js';
import { setMoneyBaseline, addMoneyCircle, resetMoneyScale } from '../calc/calculate_money.js';
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

let moneyResultSeq = 0;
let __isRepaint = false;

const __moneySelectedO2s = [];
let __moneySelectedO1 = null;

function __resetSelectedO2s() { __moneySelectedO2s.length = 0; }
function __resetSelectedO1()  { __moneySelectedO1 = null; }

function __pushSelectedO2(item) {
  try {
    const snap = __readO2SnapshotFromDOM(item?.__scope);
    const categoryKey = String(
      snap?.category_key ??
      item?.object2?.categoryKey ??
      item?.object2?.category ?? ''
    ).trim();

    const name = String(item?.object2?.name || '').trim() || null;

    // ID: перевага snapshot.id, далі userId/objectId/назва
    const objectId = String(
      snap?.id ??
      item?.object2?.userId ??
      item?.object2?.objectId ??
      item?.object2?.name ??
      ''
    ).trim();

    if (!categoryKey || !objectId || !snap) return;
    __moneySelectedO2s.push({ categoryKey, objectId, name, snapshot: snap });
  } catch {}
}

function __setSelectedO1FromDOM(scope) {
  const opt = getSelectedOption(scope, 'moneyObject1');
  if (!opt) return;
  const snap = parseOptionSnapshot(opt);
  if (!snap) return;

  const catKeySel = getVal(scope, '#moneyCategoryObject1, .object1-group .category-select') || '';
  const objectId  = String(snap?.id ?? getVal(scope, '#moneyObject1, .object1-group .object-select') ?? '').trim();
  const name      = String(opt.textContent || '').trim() || null;
  const categoryKey = String(snap.category_key ?? catKeySel).trim();

  if (!categoryKey || !objectId) return;
  __moneySelectedO1 = { categoryKey, objectId, name, snapshot: snap };
}

function __readO2SnapshotFromDOM(scope) {
  const opt = getSelectedOption(scope, 'moneyObject2');
  return parseOptionSnapshot(opt);
}

/* ─────────────── expose getters for serializer ───────────── */

try {
  (window.orbit ||= {});
  window.orbit.getMoneySelectedO1  = () => (__moneySelectedO1 ? { ...__moneySelectedO1 } : null);
  window.orbit.getMoneySelectedO2s = () => __moneySelectedO2s.map(x => ({ ...x }));
} catch {}

/* ─────────────────────── global events ───────────────────── */

try {
  window.addEventListener('orbit:ui-reset', () => {
    moneyResultSeq = 0;
    __resetSelectedO1();
    __resetSelectedO2s();
  });
  window.addEventListener('orbit:repaint-start', () => { __isRepaint = true;  });
  window.addEventListener('orbit:repaint-end',   () => { __isRepaint = false; });
} catch {}

/* ─────────────────────── main handler ────────────────────── */

/**
 * onMoneyCalculate({ scope })
 * - читає дані з адаптера (SNAPSHOT-first);
 * - ставить baseline (О1);
 * - додає результат О2;
 * - пише О1/О2 зі snapshot у буфери (лише якщо це не repaint).
 */
export function onMoneyCalculate({ scope }) {
  // Етикетка режиму
  setModeLabelKeys({ modeKey: 'panel_title_money' });

  // 1) Дані
  const data = getMoneyData(scope);

  // 1a) Зафіксувати О1 (snapshot-first) у буфер, якщо це не repaint
  if (!__isRepaint) {
    __setSelectedO1FromDOM(scope);
  }

  // Кольори
  const color1 = getColorForKey('money:baseline');
  const color2 = getColorForKey(`money:o2:${++moneyResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // D1 (м) — базовий діаметр на мапі
  const v1 = Number(data?.object1?.valueReal);                         // реальна сума
  const u1 = data?.object1?.unit || 'USD';

  resetMoneyScale();
  setMoneyBaseline({
    valueReal: v1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'money_baseline';
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
      id: 'money_o1',
      title: data?.object1?.name || '',
      color: color1,
      groupType: 'baseline',
      uiLeftLabelKey:  'ui.money.o1.left',
      uiRightLabelKey: 'ui.money.o1.right',
    });
    appendVariant({
      id: 'money_o1',
      variant: 'single',
      realValue: o1RealOk ? v1 : null,
      realUnit:  o1RealOk ? u1 : null,
      scaledMeters: baselineDiameter
    });
    if (String(data?.object1?.description || '').trim()) {
      setGroupDescription({ id: 'money_o1', description: data.object1.description });
    }
  }

  // 3) О2 через калькулятор
  const v2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || 'USD';
  const res = addMoneyCircle({
    valueReal: v2,
    unit: u2,
    color: color2
  });

  // 3a) Коло О2
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `money_r${moneyResultSeq}`);
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

  const groupId = `money_o2_${moneyResultSeq}`;
  if (!__isRepaint) {
    addGroup({
      id: groupId,
      title: data?.object2?.name || '',
      color: color2,
      groupType: 'item',
      uiLeftLabelKey:  'ui.money.o1.left',
      uiRightLabelKey: 'ui.money.o1.right',
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
    '[mode:money] O1: V=%s %s → Dscaled=%s m; O2: V=%s %s → Dscaled=%s m',
    o1RealOk ? v1 : '—', o1RealOk ? u1 : '-',
    baselineDiameter,
    o2RealOk ? v2 : '—', o2RealOk ? u2 : '-',
    scaledDiameterMeters
  );
}
