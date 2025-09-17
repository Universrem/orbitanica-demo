// /full/js/events/geo_population_buttons.js
'use strict';

/**
 * Обробник для «Географія → Населення».
 * Побудовано за еталоном «Діаметри»:
 *  - локальний буфер обраних О2 + публічний геттер (для серіалізатора);
 *  - стабільний лічильник результатів для О2 (кольори/ID кіл);
 *  - на глобальний UI-RESET скидаємо лічильник і буфер О2.
 */

import { getGeoPopulationData } from '../data/data_geo_population.js';
import { setGeoPopulationBaseline, addGeoPopulationCircle, resetGeoPopulationScale } from '../calc/calculate_geo_population.js';

import { addGroup, appendVariant, setGroupDescription } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import { addGeodesicCircle, setCircleLabelTextById } from '../globe/circles.js';

// ——— СТАН СЕСІЇ ———
let geoPopulationResultSeq = 0;       // лічильник О2
const __geoPopulationSelectedO2s = []; // буфер вибраних О2

function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim();
    const objectId = String(
      item?.object2?.userId || item?.object2?.objectId || item?.object2?.name || ''
    ).trim(); // офіц. id або fallback=назва
    if (!categoryKey || !objectId) return;
    __geoPopulationSelectedO2s.push({ categoryKey, objectId, name: name || null });
  } catch (_) {}
}

// Публічний геттер для geo_population_serializer.js
try {
  (window.orbit ||= {});
  window.orbit.getGeoPopulationSelectedO2s = () => __geoPopulationSelectedO2s.slice();
} catch (_) {}

try {
  window.addEventListener('orbit:ui-reset', () => {
    geoPopulationResultSeq = 0;
    __geoPopulationSelectedO2s.length = 0;
  });
} catch {}

/**
 * onGeoPopulationCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму «географія → населення».
 */
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
  addGroup({
    id: 'geo_population_o1',
    title: data?.object1?.name || '',
    color: color1,
    groupType: 'baseline',
    uiLeftLabelKey:  'ui.geo.population.o1.left',
    uiRightLabelKey: 'ui.geo.population.o1.right',
  });
  appendVariant({
    id: 'geo_population_o1',
    variant: 'single',
    realValue: o1RealOk ? n1 : null,
    realUnit:  o1RealOk ? u1 : null,
    scaledMeters: baselineDiameter
  });
  if (String(data?.object1?.description || '').trim()) {
    setGroupDescription({ id: 'geo_population_o1', description: data.object1.description });
  }

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
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

  const groupId = `geo_population_o2_${geoPopulationResultSeq}`;
  addGroup({
    id: groupId,
    title: data?.object2?.name || '',
    color: color2,
    groupType: 'item',
    uiLeftLabelKey:  'ui.geo.population.o1.left',
    uiRightLabelKey: 'ui.geo.population.o1.right',
    invisibleReason: res?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: res?.requiredBaselineMeters ?? null
  });
  appendVariant({
    id: groupId,
    variant: 'single',
    realValue: o2RealOk ? n2 : null,
    realUnit:  o2RealOk ? u2 : null,
    scaledMeters: scaledDiameterMeters
  });
  if (String(data?.object2?.description || '').trim()) {
    setGroupDescription({ id: groupId, description: data.object2.description });
  }

  __pushSelectedO2(data);

  console.log(
    '[mode:geo:population] D1=%sm; N1=%s%s; N2=%s%s → D2=%sm',
    baselineDiameter,
    o1RealOk ? n1.toLocaleString() : '—', o1RealOk ? u1 : '',
    o2RealOk ? n2.toLocaleString() : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
