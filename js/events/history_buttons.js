// full/js/events/history_buttons.js
'use strict';

/**
 * Еталонний обробник для режиму «Історія».
 * 1) бере StandardData з адаптера;
 * 2) задає baseline у калькуляторі (О1-start через ДІАМЕТР);
 * 3) додає кола для О1-end (якщо є) та О2 (start/end/або single) через калькулятор;
 * 4) подає результати в інфопанель (груповане API) та ставить лейбли на глобус.
 *
 * Особливості:
 *  - Масштаб лінійний по роках від pivotYear;
 *  - В інфопанелі передаємо РАДІУС (метри) як scaledMeters;
 *  - Лейбли кіл:
 *      start+end:  start → "[ Назва", end → "Назва ]"
 *      лише start (single для О1): "— Назва"
 *      лише start (single для О2): "Назва"
 */

import { getHistoryData } from '../data/data_history.js';
import {
  setHistoryBaseline,
  addHistoryCircle,
  resetHistoryScale
} from '../calc/calculate_history.js';

import { addHistoryGroup, appendHistoryVariant, setHistoryGroupDescription } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

// Лічильник сценових елементів О2 (накопичувально в межах сесії)
let historyResultSeq = 0;

// [NEW] Список обраних О2 (накопичується під час створення сцени)
const __historySelectedO2s = [];

// [NEW] Додати один О2 до списку (без побічних ефектів)
function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || '').trim();
    const name = String(item?.object2?.name || '').trim();
    const objectId = String(item?.object2?.userId || item?.object2?.name || '').trim(); // офіційний id або fallback=назва
    if (!categoryKey || !objectId) return;
    __historySelectedO2s.push({ categoryKey, objectId, name: name || null });
  } catch (_) {}
}

// [NEW] Очистити список (на нову сцену / Reset)
function __resetSelectedO2s() {
  __historySelectedO2s.length = 0;
}

// [NEW] Публічний геттер для серіалізатора
try {
  (window.orbit ||= {});
  window.orbit.getHistorySelectedO2s = () => __historySelectedO2s.slice();
} catch (_) {}


// Скидання лічильника на глобальний UI-RESET
try {
window.addEventListener('orbit:ui-reset', () => {
  historyResultSeq = 0;
  __resetSelectedO2s();
});

} catch {}

/**
 * onHistoryCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму history.
 */
export function onHistoryCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Дані
  const data = getHistoryData(scope);
  const pivot = Number(data?.pivotYear) || (new Date()).getFullYear();

  // Кольори
  const color1 = getColorForKey('history:baseline');
  const color2 = getColorForKey(`history:o2:${++historyResultSeq}`);

  // Вхідні величини
  const yearsStartO1 = data?.object1?.yearsStart; // |pivot - time_start|
  const y1sValid = Number.isFinite(yearsStartO1) && yearsStartO1 >= 0;

  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // ДІАМЕТР з UI
  const baselineRadius   = baselineDiameter > 0 ? baselineDiameter / 2 : 0;

  // 2) Масштаб (S = (D1/2)/yearsStart)
  resetHistoryScale();
  setHistoryBaseline({
    yearsForScale: y1sValid ? yearsStartO1 : NaN,
    circleDiameterMeters: baselineDiameter,
    color: color1,
    pivotYear: pivot
  });

  // 2a) О1-start коло (ідемпотентно: стабільний id)
  const baselineId = 'history_baseline';
  const hasEnd1 = Number.isFinite(data?.object1?.yearEnd);
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const nm0 = String(data?.object1?.name || '').trim();
      if (nm0) {
        // Для start+end ставимо "[ Назва", для single (тільки start) — "— Назва"
        const lbl0 = hasEnd1 ? `[ ${nm0}` : `— ${nm0}`;
        setCircleLabelTextById(id, lbl0);
      }
    }
  }

  // 2b) Інфопанель: група О1 + варіант start/або single (ЄДИНА ЛОГІКА з О2)
  const y1_start = data?.object1?.yearStart;
  const y1_start_ok = Number.isFinite(y1_start);

  addHistoryGroup({
    id: 'history_o1',
    title: data?.object1?.name || '',
    color: color1,
    groupType: 'baseline',
    // УНІФІКОВАНІ колонкові лейбли, щоб групи О1 та О2 рендерилися однаково
    uiLeftLabelKey:  'history.labels.o1.left',
    uiRightLabelKey: 'history.labels.o1.right',
  });

  appendHistoryVariant({
    id: 'history_o1',
    variant: hasEnd1 ? 'start' : 'single', // якщо нема end, це ОДИН запис з '-'
    realValue: y1_start_ok ? y1_start : null,
    realUnit: 'рік',
    scaledMeters: baselineRadius // в історії scaledMeters = РАДІУС
  });

  if (String(data?.object1?.description || '').trim()) {
    setHistoryGroupDescription({
      id: 'history_o1',
      description: data?.object1?.description
    });
  }

  // 2c) Мікроколо поточного року (центр) — ідемпотентно, стабільний id
  if (baselineRadius > 0) {
    const pivotColor = color1; // або getColorForKey('history:pivot')
    const EPS = 1e-9; // роки; >0, щоб радіус не був 0
    const resC = addHistoryCircle({ year: pivot + EPS, pivotYear: pivot, color: pivotColor });
    if (resC && Number(resC?.scaledRadiusMeters) > 0) {
      const pid = addGeodesicCircle(resC.scaledRadiusMeters, pivotColor, 'history_pivot');
      if (pid) setCircleLabelTextById(pid, String(pivot)); // підпис = поточний рік
    }
  }

  // ——— LOCK O1 UI ДО RESET + START SESSION ———
  const baselineValid = y1sValid && baselineDiameter > 0;
  if (baselineValid && scope) {
    const o1group = scope.querySelector('.object1-group');
    if (o1group) {
      o1group.classList.add('is-locked');
      o1group.querySelectorAll('select, input, button, textarea')
        .forEach(el => { el.disabled = true; });
    }
    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}
  }

  // 3) О1-end — ідемпотентно, стабільний id (якщо є)
  const y1_end = data?.object1?.yearEnd;
  let resEnd; // для логів
  if (Number.isFinite(y1_end)) {
    resEnd = addHistoryCircle({ year: y1_end, pivotYear: pivot, color: color1 });
    if (resEnd && Number(resEnd.scaledRadiusMeters) > 0) {
      const id = addGeodesicCircle(resEnd.scaledRadiusMeters, color1, 'history_o1_end');
      if (id) {
        const nm = String(data?.object1?.name || '').trim();
        if (nm) setCircleLabelTextById(id, `${nm} ]`);
      }
    }

    appendHistoryVariant({
      id: 'history_o1',
      variant: 'end',
      realValue: y1_end,
      realUnit: 'рік',
      scaledMeters: resEnd?.scaledRadiusMeters || 0,
      invisibleReason: resEnd?.tooLarge ? 'tooLarge' : null,
      requiredBaselineMeters: resEnd?.requiredBaselineMeters ?? null
    });
  }

  // 4) О2 (start/end або single)
  const o2name = String(data?.object2?.name || '').trim();
  const o2desc = String(data?.object2?.description || '').trim();

  const y2_start = data?.object2?.yearStart;
  const y2_end   = data?.object2?.yearEnd;
  const hasStart2 = Number.isFinite(y2_start);
  const hasEnd2   = Number.isFinite(y2_end);

  // Якщо взагалі немає дат і назви — нічого не додаємо
  if (!hasStart2 && !hasEnd2 && !o2name) {
    console.log('[mode:history] O2: no data; skip');
  } else {
    // 4x) Група О2 (уніфіковані лейбли колонок!)
    const groupId = `history_o2_${historyResultSeq}`;
    addHistoryGroup({
      id: groupId,
      title: o2name || '',
      color: color2,
      groupType: 'item',
      uiLeftLabelKey:  'history.labels.o1.left',
      uiRightLabelKey: 'history.labels.o1.right',
    });
    if (o2desc) {
      setHistoryGroupDescription({
        id: groupId,
        description: o2desc
      });
    }

    // 4a) start (або single, якщо end немає)
    let resS; // для логів
    if (hasStart2) {
      resS = addHistoryCircle({ year: y2_start, pivotYear: pivot, color: color2 });
      if (resS && Number(resS.scaledRadiusMeters) > 0) {
        const id = addGeodesicCircle(resS.scaledRadiusMeters, color2, `${groupId}_start`);
        if (id && o2name) {
          // Для О2 single — просто "Назва", для start+end — "[ Назва"
          const lbl2 = hasEnd2 ? `[ ${o2name}` : `${o2name}`;
          setCircleLabelTextById(id, lbl2);
        }
      }
      appendHistoryVariant({
        id: groupId,
        variant: hasEnd2 ? 'start' : 'single',
        realValue: y2_start,
        realUnit: 'рік',
        scaledMeters: resS?.scaledRadiusMeters || 0,
        invisibleReason: resS?.tooLarge ? 'tooLarge' : null,
        requiredBaselineMeters: resS?.requiredBaselineMeters ?? null
      });
    }

    // 4b) end
    let resE; // для логів
    if (hasEnd2) {
      resE = addHistoryCircle({ year: y2_end, pivotYear: pivot, color: color2 });
      if (resE && Number(resE.scaledRadiusMeters) > 0) {
        const id = addGeodesicCircle(resE.scaledRadiusMeters, color2, `${groupId}_end`);
        if (id && o2name) setCircleLabelTextById(id, `${o2name} ]`);
      }
      appendHistoryVariant({
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
  // [NEW] Запам'ятати щойно доданий О2 для збереження сцени
  __pushSelectedO2(data);

  // Логи
  console.log(
    '[mode:history] pivot=%s; O1: start=%s → R=%sm; O1.end=%s → R=%sm; O2: start=%s → R=%sm; end=%s → R=%sm',
    pivot,
    Number.isFinite(data?.object1?.yearStart) ? data.object1.yearStart : '—', baselineRadius,
    Number.isFinite(data?.object1?.yearEnd) ? data.object1.yearEnd : '—', (typeof resEnd !== 'undefined' && resEnd?.scaledRadiusMeters) ? resEnd.scaledRadiusMeters : '—',
    Number.isFinite(y2_start) ? y2_start : '—', (typeof resS !== 'undefined' && resS?.scaledRadiusMeters) ? resS.scaledRadiusMeters : '—',
    Number.isFinite(y2_end) ? y2_end : '—', (typeof resE !== 'undefined' && resE?.scaledRadiusMeters) ? resE.scaledRadiusMeters : '—'
  );
}
