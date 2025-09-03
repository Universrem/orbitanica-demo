// full/js/events/distance_buttons.js
'use strict';

/**
 * Еталонний обробник для режиму «Відстань».
 * Контракт:
 *   1) бере StandardData з адаптера;
 *   2) задає baseline у калькуляторі;
 *   3) додає коло для О2 через калькулятор (лінійний масштаб);
 *   4) викликає системні рендери кіл та інфопанель.
 */

import { getDistanceData } from '../data/data_distance.js';
import { setDistanceBaseline, addDistanceCircle, resetDistanceScale } from '../calc/calculate_distance.js';

import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

// Лічильник для унікальних id кіл О2
let distanceResultSeq = 0;

/**
 * onDistanceCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму distance.
 */
export function onDistanceCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getDistanceData(scope);

  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('distance:baseline');
  const color2 = getColorForKey(`distance:o2:${++distanceResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // м
  const realD1 = Number(data?.object1?.valueReal); // реальний діаметр О1 (у баз. од., напр. км)
  const u1 = data?.object1?.unit || 'km';

  resetDistanceScale(); // чистий стан на кожен розрахунок
  setDistanceBaseline({
    valueReal: realD1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло (якщо діаметр > 0)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'distance_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      // підпис: назва О1
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline
  const o1RealOk = Number.isFinite(realD1) && realD1 > 0;
  setBaselineResult({
    libIndex: data?.object1?.libIndex ?? null,
    realValue: o1RealOk ? realD1 : null,
    realUnit:  o1RealOk ? u1 : null,
    scaledMeters: baselineDiameter,  // діаметр базового кола на мапі (м)
    name: data?.object1?.name || '',
    description: data?.object1?.description || '',
    color: color1,
    // Для «Відстані» над О1 мають бути діаметри:
    uiLeftLabelKey:  'diameter.labels.o1.left',   // "Діаметр"
    uiRightLabelKey: 'diameter.labels.o1.right',  // "Масштабований діаметр"
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

  // 3) О2: обчислити через калькулятор (distance_to_earth у баз. од., напр. км)
  const dist2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || 'km';
  const res = addDistanceCircle({
    valueReal: dist2,
    unit: u2,
    color: color2
  });

  // 3a) Намалювати коло О2 (якщо радіус валідний)
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `distance_r${distanceResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 4) Інфопанель: результат О2
  const o2RealOk = Number.isFinite(dist2) && dist2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

  addResult({
    libIndex: data?.object2?.libIndex ?? null,
    realValue: o2RealOk ? dist2 : null,
    realUnit:  o2RealOk ? u2 : null,
    scaledMeters: scaledDiameterMeters, // діаметр, але в підписах О2 показуємо відстань → радіус
    name: data?.object2?.name || '',
    description: data?.object2?.description || '',
    color: color2,
    invisibleReason: res?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: res?.requiredBaselineMeters ?? null,
    // Спеціальні лейбли для О2 у «Відстані»
    uiLeftLabelKey:  'distance.labels.o2.left',   // "Відстань до Землі"
    uiRightLabelKey: 'distance.labels.o2.right',  // "Масштабована відстань (радіус)"
  });

  // Консоль для діагностики
  console.log(
    '[mode:distance] D1=%sm; realD1=%s%s; dist2=%s%s → D2=%sm',
    baselineDiameter,
    o1RealOk ? realD1.toLocaleString() : '—', o1RealOk ? u1 : '',
    o2RealOk ? dist2.toLocaleString() : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
