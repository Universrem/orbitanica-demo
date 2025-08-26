// full/js/events/history_buttons.js
'use strict';

import { getHistoryData } from '../data/data_history.js';
import { addHistoryGroup, appendHistoryVariant, setHistoryGroupDescription } from '../ui/infoPanel.js';
import { formatHistoryItemName, formatHistoryCircleLabel } from '../ui/ip_text_history.js';
import { getColorForKey } from '../utils/color.js';
import { setCircleLabelTextById } from '../globe/circles.js';
import { setHistoryBaseline, addHistoryCircle } from '../calc/calculate_history.js';

export function onHistoryCalculate(ctx = {}) {
  const data = getHistoryData();
  if (!data || !data.object1) return;

  // 1) О1 — базове коло та масштаб
  const o1 = data.object1;
  const color1 = getColorForKey(`hist:${o1.name || o1.libIndex}`);

  // Для масштабу беремо перший валідний часовий орієнтир: спершу "початок", якщо його немає — "кінець"
  const yearsForScale =
    Number.isFinite(o1.yearsStart) && o1.yearsStart > 0 ? o1.yearsStart
    : (Number.isFinite(o1.yearsEnd) && o1.yearsEnd > 0 ? o1.yearsEnd : null);

  const base = setHistoryBaseline(yearsForScale, o1.diameterScaled, color1);

  // Центровий напис "2025" тим самим стилем, що й підписи кіл.
// Малюємо мікро-коло на поточному році і клеїмо до нього лейбл.
const __CENTER_EPS_YEARS = 1e-9; // достатньо >0, щоб пройшла валідація
const centerCircle = addHistoryCircle(__CENTER_EPS_YEARS, color1);
if (centerCircle.id) {
  setCircleLabelTextById(centerCircle.id, '2025');
}

  // Інфопанель — шапка та перший рядок (О1)
  const isRangeO1 = Number.isFinite(o1.yearStart) && Number.isFinite(o1.yearEnd);
  const firstYear = isRangeO1 ? o1.yearStart : (o1.yearStart ?? o1.yearEnd);

const g1id = `hist:evt:${o1.id ?? o1.key ?? 'base'}`;

addHistoryGroup({
  id: g1id,
  title: o1.name,
  color: color1,
  groupType: 'baseline'
});

appendHistoryVariant({
  id: g1id,
  variant: isRangeO1 ? 'start' : null,
  realValue: firstYear,
  realUnit: 'рік',
  scaledMeters: base.scaledRadiusMeters || null
});

setHistoryGroupDescription({ id: g1id, description: o1.description || '' });


  // Лейбл біля базового кола (подія О1 — початок або одинична дата)
  if (base.id) {
  const baseLabel = isRangeO1 ? `⊢ ${o1.name}` : `${o1.name}`;
    setCircleLabelTextById(base.id, baseLabel);
  }

  // Друге коло для О1 (якщо є кінець)
if (isRangeO1 && Number.isFinite(o1.yearsEnd) && o1.yearsEnd > 0) {
  const resEnd = addHistoryCircle(o1.yearsEnd, color1);
  appendHistoryVariant({
    id: g1id,
    variant: 'end',
    realValue: o1.yearEnd,
    realUnit: 'рік',
    scaledMeters: resEnd.scaledRadiusMeters || null,
    invisibleReason: resEnd.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: resEnd.requiredBaselineMeters || null
  });
  if (resEnd.id) {
    setCircleLabelTextById(resEnd.id, formatHistoryCircleLabel(o1.name, o1.yearEnd, 'end'));
  }
}


  // 🔒 заблокувати поле О1 (до Reset)
  const g1 = ctx.object1Group;
  if (g1) {
    g1.classList.add('is-locked');
    g1.querySelectorAll('select, input, button').forEach(el => {
      const act = el.dataset?.action || el.id;
      if (act === 'calculate' || act === 'reset') return;
      el.disabled = true;
    });
  }

  if (!window.__orbitSessionActive) {
    window.__orbitSessionActive = true;
    window.dispatchEvent(new CustomEvent('orbit:session-start'));
  }

  // 2) О2 — один або два додаткові кола
  const o2 = data.object2;
  if (o2) {
    const color2 = getColorForKey(`hist:${o2.name || o2.libIndex}`);
// Стабільний groupId для О2 (подія з бібліотеки історії)
const g2id = `hist:evt:${(o2.id ?? o2.key ?? String(o2.name || 'item')).toString().toLowerCase().replace(/\s+/g,'_')}`;

// Створюємо/оновлюємо групу О2 та опис (опис один раз під групою)
addHistoryGroup({ id: g2id, title: o2.name, color: color2, groupType: 'item' });
setHistoryGroupDescription({ id: g2id, description: o2.description || '' });



    // старт
if (Number.isFinite(o2.yearsStart) && o2.yearsStart > 0) {
  const resS = addHistoryCircle(o2.yearsStart, color2);

  appendHistoryVariant({
    id: g2id,
    variant: (o2.yearEnd != null ? 'start' : null),
    realValue: o2.yearStart,
    realUnit: 'рік',
    scaledMeters: resS?.scaledRadiusMeters ?? null,
    invisibleReason: resS?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: resS?.requiredBaselineMeters ?? null
  });

if (resS.id) {
  const hasEnd = (o2.yearsEnd ?? o2.yearEnd) != null;
  setCircleLabelTextById(
    resS.id,
    hasEnd ? `К ${o2.name}` : `${o2.name}`
  );
}

}



    // кінець (якщо є)
// кінець (якщо є)
// кінець (якщо є)
if (Number.isFinite(o2.yearsEnd) && o2.yearsEnd > 0) {
  const resE = addHistoryCircle(o2.yearsEnd, color2);

  appendHistoryVariant({
    id: g2id,
    variant: 'end',
    realValue: o2.yearEnd,
    realUnit: 'рік',
    scaledMeters: resE?.scaledRadiusMeters ?? null,
    invisibleReason: resE?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: resE?.requiredBaselineMeters ?? null
  });

if (resE.id) {
  setCircleLabelTextById(resE.id, `К ${o2.name}`);
}

}


  }
}
