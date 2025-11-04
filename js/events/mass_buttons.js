// /full/js/events/mass_buttons.js
'use strict';

/**
 * Обробник для режиму «Маса».
 * Еталон «Діаметри» зі SNAPSHOT-FIRST:
 *  - фіксуємо О1 з snapshot + baseline діаметра;
 *  - додаємо О2, читаючи snapshot з option.dataset.snapshot;
 *  - під час repaint не пишемо в інфопанель і не пушимо в буфери;
 *  - серіалізатор читає буфери через window.orbit.* геттери.
 */

import { getMassData } from '../data/data_mass.js';
import { setMassBaseline, addMassCircle, resetMassScale } from '../calc/calculate_mass.js';
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

let massResultSeq = 0;
let __isRepaint = false;

const __massSelectedO2s = [];
let __massSelectedO1 = null;

function __resetSelectedO2s() { __massSelectedO2s.length = 0; }
function __resetSelectedO1()  { __massSelectedO1 = null; }

function __readO2SnapshotFromDOM(scope) {
  const opt = getSelectedOption(scope, 'massObject2');
  return parseOptionSnapshot(opt);
}

function __setSelectedO1FromDOM(scope) {
  const opt = getSelectedOption(scope, 'massObject1');
  if (!opt) return;
  const snap = parseOptionSnapshot(opt);
  if (!snap) return;

  const catKeySel  = getVal(scope, '#massCategoryObject1');
  const objectId   = String(snap?.id ?? getVal(scope, '#massObject1') ?? '').trim();
  const name       = String(opt.textContent || '').trim() || null;
  const categoryKey= String(snap.category_key ?? catKeySel).trim();

  if (!categoryKey || !objectId) return;
  __massSelectedO1 = { categoryKey, objectId, name, snapshot: snap };
}

function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim() || null;

    // пріоритет snapshot.id → userId → objectId → name
    const snap = __readO2SnapshotFromDOM(item?.__scope);
    const objectId = String(
      snap?.id ?? item?.object2?.userId ?? item?.object2?.objectId ?? item?.object2?.name ?? ''
    ).trim();

    if (!categoryKey || !objectId || !snap) return;
    __massSelectedO2s.push({ categoryKey, objectId, name, snapshot: snap });
  } catch {}
}

/* ─────────────── expose getters for serializer ───────────── */

try {
  (window.orbit ||= {});
  window.orbit.getUniversMassSelectedO1  = () => (__massSelectedO1 ? { ...__massSelectedO1 } : null);
  window.orbit.getUniversMassSelectedO2s = () => __massSelectedO2s.map(x => ({ ...x }));
} catch {}

/* ─────────────────────── global events ───────────────────── */

try {
  window.addEventListener('orbit:ui-reset', () => {
    massResultSeq = 0;
    __resetSelectedO1();
    __resetSelectedO2s();
  });
  window.addEventListener('orbit:repaint-start', () => { __isRepaint = true;  });
  window.addEventListener('orbit:repaint-end',   () => { __isRepaint = false; });
} catch {}

/* ─────────────────────── main handler ────────────────────── */

/**
 * onMassCalculate({ scope })
 * - читає дані з адаптера;
 * - ставить baseline (О1);
 * - додає результат О2;
 * - пише О1/О2 зі snapshot у буфери (лише якщо це не repaint).
 */
export function onMassCalculate({ scope }) {
  // Заголовок режиму
  setModeLabelKeys({ modeKey: 'panel_title_univers', subKey: 'panel_title_univers_mass' });

  // 1) Дані
  const data = getMassData(scope);

  // 1a) Зафіксувати О1 (snapshot-first) у буфер, якщо це не repaint
  if (!__isRepaint) {
    __setSelectedO1FromDOM(scope);
  }

  // Кольори
  const color1 = getColorForKey('mass:baseline');
  const color2 = getColorForKey(`mass:o2:${++massResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // D1 (м)
  const m1 = Number(data?.object1?.valueReal);                         // маса О1 (база mass)
  const u1 = data?.object1?.unit || '';

  resetMassScale();
  setMassBaseline({
    valueReal: m1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'mass_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline (без ключів ліво/право)
  const o1RealOk = Number.isFinite(m1) && m1 > 0;
  if (!__isRepaint) {
    addGroup({
      id: 'mass_o1',
      title: data?.object1?.name || '',
      color: color1,
      groupType: 'baseline',
      uiLeftLabelKey:  'mass.labels.o1.left',   
      uiRightLabelKey: 'mass.labels.o1.right',
    });
    appendVariant({
      id: 'mass_o1',
      variant: 'single',
      realValue: o1RealOk ? m1 : null,
      realUnit:  o1RealOk ? u1 : null,
      scaledMeters: baselineDiameter
    });
    if (String(data?.object1?.description || '').trim()) {
      setGroupDescription({ id: 'mass_o1', description: data.object1.description });
    }
  }

  // ——— START SESSION ———
  const baselineValid = (Number.isFinite(m1) && m1 > 0) && (baselineDiameter > 0);
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
  const m2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || '';
  const res = addMassCircle({
    valueReal: m2,
    unit: u2,
    color: color2
  });

  // 3a) Коло О2
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `mass_r${massResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 3b) Інфопанель для О2 (без ключів ліво/право)
  const o2RealOk = Number.isFinite(m2) && m2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

  const groupId = `mass_o2_${massResultSeq}`;
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
      realValue: o2RealOk ? m2 : null,
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
    '[mode:mass] O1: M=%s %s → Dscaled=%s m; O2: M=%s %s → Dscaled=%s m',
    o1RealOk ? m1 : '—', o1RealOk ? u1 : '',
    baselineDiameter,
    o2RealOk ? m2 : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
