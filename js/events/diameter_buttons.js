// full/js/events/diameter_buttons.js
'use strict';

/**
 * Обробник для режиму «Діаметри».
 * Рівно за еталоном «Гроші», але з лінійним масштабом діаметрів.
 */

import { getDiameterData } from '../data/data_diameter.js';
import { setDiameterBaseline, addDiameterCircle, resetDiameterScale } from '../calc/calculate_diameter.js';

import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

// Лічильник для унікальних id кіл О2
let diameterResultSeq = 0;

/**
 * onDiameterCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму «діаметри».
 */
export function onDiameterCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getDiameterData(scope);

  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('diameter:baseline');
  const color2 = getColorForKey(`diameter:o2:${++diameterResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // D1 (м)
  const v1 = Number(data?.object1?.diameterReal);                      // V1 (м)
  const u1 = data?.object1?.unit || 'm';

  resetDiameterScale(); // чистий стан на кожен розрахунок
  setDiameterBaseline({
    diameterReal: v1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло (якщо діаметр > 0)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'diameter_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline
  const o1RealOk = Number.isFinite(v1) && v1 > 0;
  setBaselineResult({
    libIndex: data?.object1?.libIndex ?? null,
    realValue: o1RealOk ? v1 : null,
    realUnit:  o1RealOk ? u1 : null,
    scaledMeters: baselineDiameter,  // діаметр базового кола на мапі
    name: data?.object1?.name || '',
    description: data?.object1?.description || '',
    color: color1,
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

  // 3) О2: обчислити через калькулятор
  const v2 = Number(data?.object2?.diameterReal); // V2 (м)
  const u2 = data?.object2?.unit || 'm';
  const res = addDiameterCircle({
    diameterReal: v2,
    unit: u2,
    color: color2
  });

  // 3a) Намалювати коло О2 (якщо радіус валідний)
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `diameter_r${diameterResultSeq}`);
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

  // Консоль для діагностики
  console.log(
    '[mode:diameter] D1=%sm; V1=%sm; V2=%sm → D2=%sm',
    baselineDiameter,
    o1RealOk ? v1.toLocaleString() : '—',
    o2RealOk ? v2.toLocaleString() : '—',
    scaledDiameterMeters
  );
}
