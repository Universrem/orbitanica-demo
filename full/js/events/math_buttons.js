// full/js/events/math_buttons.js
'use strict';

/**
 * Еталонний обробник для режиму «Математика».
 * Робить рівно те, що описано в Контракті:
 *   1) бере StandardData з адаптера;
 *   2) задає baseline у калькуляторі;
 *   3) додає коло для О2 через калькулятор;
 *   4) викликає системні рендери кіл та інфопанель.
 *
 * Жодних сторонніх залежностей, DOM-хаків чи доступів до інших режимів.
 */

import { getMathData } from '../data/data_math.js';
import { setMathBaseline, addMathCircle, resetMathScale } from '../calc/calculate_math.js';

import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

// Лічильник для унікальних id кіл О2
let mathResultSeq = 0;

/**
 * onMathCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму math.
 */
export function onMathCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getMathData(scope);

  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('math:baseline');
  const color2 = getColorForKey(`math:o2:${++mathResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0;
  const v1 = Number(data?.object1?.valueReal);
  const u1Raw = data?.object1?.unit || 'unit';
  const u1 = u1Raw && u1Raw.toLowerCase() !== 'unit' ? u1Raw : null;

  resetMathScale(); // чистий стан на кожен розрахунок
  setMathBaseline({
    valueReal: v1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло (якщо діаметр > 0)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'math_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      // підпис: просто назва О1
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline (без NaN — якщо число невалідне, не віддаємо realValue/realUnit)
  const o1RealOk = Number.isFinite(v1) && v1 > 0;
  setBaselineResult({
    libIndex: data?.object1?.libIndex ?? null,
    realValue: o1RealOk ? v1 : null,
    realUnit:  o1RealOk ? u1 : null,
    scaledMeters: baselineDiameter,  // діаметр базового кола на мапі
    name: data?.object1?.name || '',
    description: data?.object1?.description || '',
    color: color1,
    // ЄДИНА зміна під математику — написи над О1:
    // "Число → Діаметр (площа кола пропорційна числу)"
    uiLeftLabelKey:  'ui.math.o1.left',
    uiRightLabelKey: 'ui.math.o1.right',
  });

  // ——— LOCK O1 UI ДО RESET + START SESSION ———
  const baselineValid = o1RealOk && baselineDiameter > 0;
  if (baselineValid && scope) {
    const o1group = scope.querySelector('.object1-group');
    if (o1group) {
      o1group.classList.add('is-locked');
      // Вимкнути всі контроли в секторі О1
      o1group.querySelectorAll('select, input, button, textarea')
        .forEach(el => { el.disabled = true; });
    }
    // Позначити початок активної сесії (для попередження при зміні мови)
    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}
  }

  // 3) О2: обчислити через калькулятор
  const v2 = Number(data?.object2?.valueReal);
  const u2Raw = data?.object2?.unit || 'unit';
  const u2 = u2Raw && u2Raw.toLowerCase() !== 'unit' ? u2Raw : null;
  const res = addMathCircle({
    valueReal: v2,
    unit: u2,
    color: color2
  });

  // 3a) Намалювати коло О2 (якщо радіус валідний)
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `math_r${mathResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 4) Інфопанель: результат О2
  const o2RealOk = Number.isFinite(v2) && v2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

  addResult({
    libIndex: data?.object2?.libIndex ?? null,
    realValue: o2RealOk ? v2 : null,
    realUnit:  o2RealOk ? u2 : null,
    scaledMeters: scaledDiameterMeters,
    name: data?.object2?.name || '',
    description: data?.object2?.description || '',
    color: color2,
    invisibleReason: res?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: res?.requiredBaselineMeters ?? null
  });

  // Консоль для діагностики (акуратний формат)
  const u1s = u1 ? u1 : '';
  const u2s = u2 ? u2 : '';
  console.log('[mode:math] D1=%sm; V1=%s%s; V2=%s%s → D2=%sm', baselineDiameter,
    o1RealOk ? v1.toLocaleString() : '—', o1RealOk ? u1s : '',
    o2RealOk ? v2.toLocaleString() : '—', o2RealOk ? u2s : '',
    scaledDiameterMeters);
}
