// /full/js/events/geo_area_buttons.js
'use strict';

/**
 * Обробник для режиму «Географія → Площа».
 * Побудовано за еталоном «Діаметри»:
 *  - є локальний буфер обраних О2 + публічний геттер (для серіалізатора);
 *  - стабільний лічильник результатів для О2 (кольори/ID кіл);
 *  - на глобальний UI-RESET скидаємо лічильник і буфер О2.
 */

import { getGeoAreaData } from '../data/data_geo_area.js';
import { setGeoAreaBaseline, addGeoAreaCircle, resetGeoAreaScale } from '../calc/calculate_geo_area.js';

import { addGroup, appendVariant, setGroupDescription } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

// ——— СТАН СЕСІЇ ———

// Лічильник для унікальних id/кольорів О2 (скидається на UI-RESET)
let geoAreaResultSeq = 0;

// Локальний список вибраних О2 (накопичується під час створення сцени)
const __geoAreaSelectedO2s = [];

// Додати один О2 до списку (без побічних ефектів)
function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim();
    const objectId = String(
      item?.object2?.userId || item?.object2?.objectId || item?.object2?.name || ''
    ).trim(); // офіц. id або fallback=назва
    if (!categoryKey || !objectId) return;
    __geoAreaSelectedO2s.push({ categoryKey, objectId, name: name || null });
  } catch (_) {}
}

// Публічний геттер для серіалізатора geo_area_serializer.js
try {
  (window.orbit ||= {});
  window.orbit.getGeoAreaSelectedO2s = () => __geoAreaSelectedO2s.slice();
} catch (_) {}

// ——— ГЛОБАЛЬНІ ПОДІЇ ———
try {
  window.addEventListener('orbit:ui-reset', () => {
    geoAreaResultSeq = 0;
    __geoAreaSelectedO2s.length = 0;
  });
} catch {}


/**
 * onGeoAreaCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для підрежиму «Географія → Площа».
 */
export function onGeoAreaCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getGeoAreaData(scope);

  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('geo_area:baseline');
  const color2 = getColorForKey(`geo_area:o2:${++geoAreaResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0;
  const s1 = Number(data?.object1?.valueReal);
  const u1 = data?.object1?.unit || 'km²';

  // Завжди оновлюємо внутрішній масштаб
  resetGeoAreaScale();
  setGeoAreaBaseline({
    valueReal: s1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло (якщо діаметр > 0)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'geo_area_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline
  const o1RealOk = Number.isFinite(s1) && s1 > 0;
  addGroup({
    id: 'geo_area_o1',
    title: data?.object1?.name || '',
    color: color1,
    groupType: 'baseline',
    uiLeftLabelKey:  'ui.geo.area.o1.left',
    uiRightLabelKey: 'ui.geo.area.o1.right',
  });
  appendVariant({
    id: 'geo_area_o1',
    variant: 'single',
    realValue: o1RealOk ? s1 : null,
    realUnit:  o1RealOk ? u1 : null,
    scaledMeters: baselineDiameter
  });
  if (String(data?.object1?.description || '').trim()) {
    setGroupDescription({ id: 'geo_area_o1', description: data.object1.description });
  }

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
    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}
  }

  // 3) О2: обчислити через калькулятор
  const s2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || 'km²';
  const res = addGeoAreaCircle({
    valueReal: s2,
    unit: u2,
    color: color2
  });

  // 3a) Намалювати коло О2 (якщо радіус валідний)
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `geo_area_r${geoAreaResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 4) Інфопанель: результат О2
  const o2RealOk = Number.isFinite(s2) && s2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

  const groupId = `geo_area_o2_${geoAreaResultSeq}`;
  addGroup({
    id: groupId,
    title: data?.object2?.name || '',
    color: color2,
    groupType: 'item',
    uiLeftLabelKey:  'ui.geo.area.o1.left',
    uiRightLabelKey: 'ui.geo.area.o1.right',
    invisibleReason: res?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: res?.requiredBaselineMeters ?? null
  });
  appendVariant({
    id: groupId,
    variant: 'single',
    realValue: o2RealOk ? s2 : null,
    realUnit:  o2RealOk ? u2 : null,
    scaledMeters: scaledDiameterMeters
  });
  if (String(data?.object2?.description || '').trim()) {
    setGroupDescription({ id: groupId, description: data.object2.description });
  }

  __pushSelectedO2(data);

  // Консоль для діагностики
  console.log(
    '[mode:geo:area] O1: A=%s%s → Dscaled=%s; O2: A=%s%s → Dscaled=%s',
    o1RealOk ? s1 : '—', o1RealOk ? u1 : '',
    baselineDiameter,
    o2RealOk ? s2 : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
