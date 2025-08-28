// full/js/events/geo_population_buttons.js
'use strict';

/**
 * Обробник для «Географія → Населення».
 * 1) StandardData з адаптера;
 * 2) baseline у калькуляторі;
 * 3) коло О2 з калькулятора;
 * 4) системні рендери + інфопанель.
 */

import { getGeoPopulationData } from '../data/data_geo_population.js';
import { setGeoPopulationBaseline, addGeoPopulationCircle, resetGeoPopulationScale } from '../calc/calculate_geo_population.js';

import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import { addGeodesicCircle, setCircleLabelTextById } from '../globe/circles.js';

let geoPopulationResultSeq = 0;

export function onGeoPopulationCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) дані
  const data = getGeoPopulationData(scope);

  const color1 = getColorForKey('geo_population:baseline');
  const color2 = getColorForKey(`geo_population:o2:${++geoPopulationResultSeq}`);

  // 2) baseline
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0;
  const n1 = Number(data?.object1?.valueReal);
  const u1 = data?.object1?.unit || 'people';

  resetGeoPopulationScale();
  setGeoPopulationBaseline({
    valueReal: n1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // намалювати базове коло (якщо є)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'geo_population_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // інфопанель baseline
  const o1RealOk = Number.isFinite(n1) && n1 > 0;
  setBaselineResult({
    libIndex: data?.object1?.libIndex ?? null,
    realValue: o1RealOk ? n1 : null,
    realUnit:  o1RealOk ? u1 : null,
    scaledMeters: baselineDiameter,
    name: data?.object1?.name || '',
    description: data?.object1?.description || '',
    color: color1,
    uiLeftLabelKey:  'ui.geo.population.o1.left',
    uiRightLabelKey: 'ui.geo.population.o1.right',
  });

  // заблокувати О1 до reset
  const baselineValid = o1RealOk && baselineDiameter > 0;
  if (baselineValid && scope) {
    const o1group = scope.querySelector('.object1-group');
    if (o1group) {
      o1group.classList.add('is-locked');
      o1group.querySelectorAll('select, input, button, textarea').forEach(el => { el.disabled = true; });
    }
    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}
  }

  // 3) О2
  const n2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || 'people';
  const res = addGeoPopulationCircle({ valueReal: n2, unit: u2, color: color2 });

  // коло О2
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `geo_population_r${geoPopulationResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // інфопанель О2
  const o2RealOk = Number.isFinite(n2) && n2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0 ? 2 * Number(res.scaledRadiusMeters) : 0;

  addResult({
    libIndex: data?.object2?.libIndex ?? null,
    realValue: o2RealOk ? n2 : null,
    realUnit:  o2RealOk ? u2 : null,
    scaledMeters: scaledDiameterMeters,
    name: data?.object2?.name || '',
    description: data?.object2?.description || '',
    color: color2,
    invisibleReason: res?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: res?.requiredBaselineMeters ?? null
  });

  console.log(
    '[mode:geo:population] D1=%sm; N1=%s%s; N2=%s%s → D2=%sm',
    baselineDiameter,
    o1RealOk ? n1.toLocaleString() : '—', o1RealOk ? u1 : '',
    o2RealOk ? n2.toLocaleString() : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
