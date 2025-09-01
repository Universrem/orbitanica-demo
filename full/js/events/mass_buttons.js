// full/js/events/mass_buttons.js
'use strict';

/**
 * Еталонний обробник для режиму «Маса».
 * Контракт:
 *   1) бере StandardData з адаптера;
 *   2) задає baseline у калькуляторі;
 *   3) додає коло для О2 через калькулятор;
 *   4) викликає системні рендери кіл та інфопанель.
 */

import { getMassData } from '../data/data_mass.js';
import { setMassBaseline, addMassCircle, resetMassScale } from '../calc/calculate_mass.js';

import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

// Лічильник для унікальних id кіл О2
let massResultSeq = 0;

/**
 * onMassCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму mass.
 */
export function onMassCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getMassData(scope);

  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('mass:baseline');
  const color2 = getColorForKey(`mass:o2:${++massResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0;
  const m1 = Number(data?.object1?.valueReal);
  const u1 = data?.object1?.unit || '';

  resetMassScale(); // чистий стан на кожен розрахунок
  setMassBaseline({
    valueReal: m1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло (якщо діаметр > 0)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineTag = 'mass_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineTag);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline
  const o1RealOk = Number.isFinite(m1) && m1 > 0;
  setBaselineResult({
    libIndex: data?.object1?.libIndex ?? null,
    realValue: o1RealOk ? m1 : null,
    realUnit:  o1RealOk ? u1 : null,
    scaledMeters: baselineDiameter,  // діаметр базового кола на мапі
    name: data?.object1?.name || '',
    description: data?.object1?.description || '',
    color: color1,
    uiLeftLabelKey:  'mass.labels.o1.left',   // "Маса"
    uiRightLabelKey: 'mass.labels.o1.right',  // "Діаметр (площа кола ∝ масі)"
  });

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

  addResult({
    libIndex: data?.object2?.libIndex ?? null,
    realValue: o2RealOk ? m2 : null,
    realUnit:  o2RealOk ? u2 : null,
    scaledMeters: scaledDiameterMeters,
    name: data?.object2?.name || '',
    description: data?.object2?.description || '',
    color: color2,
    invisibleReason: res?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: res?.requiredBaselineMeters ?? null
  });

  // Консоль для діагностики
  console.log(
    '[mode:mass] D1=%sm; M1=%s%s; M2=%s%s → D2=%sm',
    baselineDiameter,
    o1RealOk ? m1.toLocaleString() : '—', o1RealOk ? u1 : '',
    o2RealOk ? m2.toLocaleString() : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
