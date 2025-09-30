// /full/js/events/mass_buttons.js
'use strict';

/**
 * Обробник для режиму «Маса».
 * Побудовано за еталоном «Діаметри»:
 *  - локальний буфер обраних О2 + публічний геттер (для серіалізатора);
 *  - стабільний лічильник результатів для О2 (кольори/ID кіл);
 *  - на глобальний UI-RESET скидаємо лічильник і буфер;
 *  - інфопанель через універсальні addGroup/appendVariant/setGroupDescription.
 */

import { getMassData } from '../data/data_mass.js';
import { setMassBaseline, addMassCircle, resetMassScale } from '../calc/calculate_mass.js';
import { addGroup, appendVariant, setGroupDescription, setModeLabelKeys } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

// ——— СТАН СЕСІЇ ———
let massResultSeq = 0;                 // лічильник О2
const __massSelectedO2s = [];          // буфер вибраних О2

function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim();
    const objectId = String(
      item?.object2?.userId || item?.object2?.objectId || item?.object2?.name || ''
    ).trim(); // офіц. id або fallback=назва
    if (!categoryKey || !objectId) return;
    __massSelectedO2s.push({ categoryKey, objectId, name: name || null });
  } catch (_) {}
}

try {
  (window.orbit ||= {});
  window.orbit.getUniversMassSelectedO2s = () => __massSelectedO2s.slice();
} catch (_) {}

try {
  window.addEventListener('orbit:ui-reset', () => {
    massResultSeq = 0;
    __massSelectedO2s.length = 0;
  });
} catch {}

/**
 * onMassCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму «маса».
 */
export function onMassCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getMassData(scope);
  // Підпис інфопанелі: «Всесвіт: Маса»
  setModeLabelKeys({
    modeKey: 'panel_title_univers',
    subKey:  'panel_title_univers_mass'
  });


  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('mass:baseline');
  const color2 = getColorForKey(`mass:o2:${++massResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // D1 (м) — масштабований діаметр на мапі
  const m1 = Number(data?.object1?.valueReal);                         // реальна маса
  const u1 = data?.object1?.unit || '';

  resetMassScale();
  setMassBaseline({
    valueReal: m1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло (якщо діаметр > 0)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'mass_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline
  const o1RealOk = Number.isFinite(m1) && m1 > 0;
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
    scaledMeters: baselineDiameter // діаметр базового кола на мапі
  });
  if (String(data?.object1?.description || '').trim()) {
    setGroupDescription({ id: 'mass_o1', description: data.object1.description });
  }

  // ——— LOCK O1 UI ДО RESET + START SESSION ———
  const baselineValid = o1RealOk && baselineDiameter > 0;
  if (baselineValid && scope) {
    const o1group = scope.querySelector('.object1-group');
    if (o1group) {
      o1group.classList.add('is-locked');
      o1group.querySelectorAll('select, input, button, textarea')
        .forEach(el => { el.disabled = true; });
    }
    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}
  }

  // 3) О2: обчислити через калькулятор
  const m2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || '';
  const res = addMassCircle({
    valueReal: m2,
    unit: u2,
    color: color2
  });

  // 3a) Намалювати коло О2 (якщо радіус валідний)
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `mass_r${massResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 4) Інфопанель: результат О2
  const o2RealOk = Number.isFinite(m2) && m2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

  const groupId = `mass_o2_${massResultSeq}`;
  addGroup({
    id: groupId,
    title: data?.object2?.name || '',
    color: color2,
    groupType: 'item',
    uiLeftLabelKey:  'mass.labels.o1.left',
    uiRightLabelKey: 'mass.labels.o1.right',
    invisibleReason: res?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: res?.requiredBaselineMeters ?? null
  });
  appendVariant({
    id: groupId,
    variant: 'single',
    realValue: o2RealOk ? m2 : null,
    realUnit:  o2RealOk ? u2 : null,
    scaledMeters: scaledDiameterMeters
  });
  if (String(data?.object2?.description || '').trim()) {
    setGroupDescription({ id: groupId, description: data.object2.description });
  }

  __pushSelectedO2(data);

  // Консоль для діагностики
  console.log(
    '[mode:mass] O1: M=%s%s → Dscaled=%s; O2: M=%s%s → Dscaled=%s',
    o1RealOk ? m1 : '—', o1RealOk ? u1 : '',
    baselineDiameter,
    o2RealOk ? m2 : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
