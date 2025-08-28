// full/js/events/geo_objects_buttons.js
'use strict';

/**
 * Обробник для «Географія → Об’єкти (довжина/висота)».
 * 1) StandardData з адаптера;
 * 2) baseline у калькуляторі;
 * 3) коло О2 з калькулятора;
 * 4) системні рендери + інфопанель.
 */

import { getGeoObjectsData } from '../data/data_geo_objects.js';
import { setGeoObjectsBaseline, addGeoObjectsCircle, resetGeoObjectsScale } from '../calc/calculate_geo_objects.js';

import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import { addGeodesicCircle, setCircleLabelTextById } from '../globe/circles.js';

let geoObjectsResultSeq = 0;

export function onGeoObjectsCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) дані
  const data = getGeoObjectsData(scope);

  const color1 = getColorForKey('geo_objects:baseline');
  const color2 = getColorForKey(`geo_objects:o2:${++geoObjectsResultSeq}`);

  // 2) baseline
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0;
  const l1m = Number(data?.object1?.valueReal);     // метри
  const u1  = data?.object1?.unit || 'm';

  resetGeoObjectsScale();
  setGeoObjectsBaseline({
    valueReal: l1m,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // намалювати базове коло (якщо є)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'geo_objects_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // інфопанель baseline
  const o1RealOk = Number.isFinite(l1m) && l1m > 0;
  setBaselineResult({
    libIndex: data?.object1?.libIndex ?? null,
    realValue: o1RealOk ? l1m : null,
    realUnit:  o1RealOk ? u1 : null,
    scaledMeters: baselineRadius,
    name: data?.object1?.name || '',
    description: data?.object1?.description || '',
    color: color1,
    uiLeftLabelKey:  'ui.geo.objects.o1.left',   // "Довжина/висота"
    uiRightLabelKey: 'ui.geo.objects.o1.right',  // "Масштабована довжина (радіус)"
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
  const l2m = Number(data?.object2?.valueReal);
  const u2  = data?.object2?.unit || 'm';
  const res = addGeoObjectsCircle({ valueReal: l2m, unit: u2, color: color2 });

  // коло О2
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `geo_objects_r${geoObjectsResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // інфопанель О2
const o2RealOk = Number.isFinite(l2m) && l2m > 0;

const scaledRadiusMeters = (res && Number(res.scaledRadiusMeters) > 0)
  ? Number(res.scaledRadiusMeters)
  : 0;

// Для консолі можемо тримати діаметр як похідний від радіуса
const scaledDiameterMeters = scaledRadiusMeters > 0 ? 2 * scaledRadiusMeters : 0;

addResult({
  libIndex: data?.object2?.libIndex ?? null,
  realValue: o2RealOk ? l2m : null,
  realUnit:  o2RealOk ? u2 : null,
  scaledMeters: scaledRadiusMeters, // показуємо РАДІУС
  name: data?.object2?.name || '',
  description: data?.object2?.description || '',
  color: color2,
  invisibleReason: res?.tooLarge ? 'tooLarge' : null,
  requiredBaselineMeters: res?.requiredBaselineMeters ?? null
});


  console.log(
    '[mode:geo:objects] D1=%sm; L1=%s%s; L2=%s%s → D2=%sm',
    baselineDiameter,
    o1RealOk ? l1m.toLocaleString() : '—', o1RealOk ? u1 : '',
    o2RealOk ? l2m.toLocaleString() : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}

