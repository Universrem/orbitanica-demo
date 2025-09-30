// /js/events/geo_objects_buttons.js
'use strict';

/**
 * Обробник для «Географія → Об’єкти (довжина/висота)».
 * Еталон «Діаметри»:
 *  - локальний буфер вибраних О2 + публічний геттер (для серіалізатора);
 *  - стабільний лічильник результатів для О2 (кольори/ID кіл);
 *  - на UI-RESET скидаємо лічильник і буфер О2.
 */

import { getGeoObjectsData } from '../data/data_geo_objects.js';
import { setGeoObjectsBaseline, addGeoObjectsCircle, resetGeoObjectsScale } from '../calc/calculate_geo_objects.js';
import { addGroup, appendVariant, setGroupDescription, setModeLabelKeys } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import { addGeodesicCircle, setCircleLabelTextById } from '../globe/circles.js';

// ——— СТАН СЕСІЇ ———

// Лічильник для унікальних id/кольорів О2 (скидається на UI-RESET)
let geoObjectsResultSeq = 0;

// Локальний список вибраних О2 (накопичується під час створення сцени)
const __geoObjectsSelectedO2s = [];

// Додати один О2 до списку (без побічних ефектів)
function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim();
    const objectId = String(
      item?.object2?.userId || item?.object2?.objectId || item?.object2?.name || ''
    ).trim(); // офіц. id або fallback=назва
    if (!categoryKey || !objectId) return;
    __geoObjectsSelectedO2s.push({ categoryKey, objectId, name: name || null });
  } catch (_) {}
}

// Очистити список (на нову сцену)
function __resetSelectedO2s() {
  __geoObjectsSelectedO2s.length = 0;
}

// Публічний геттер для серіалізатора geo_objects_serializer.js
try {
  (window.orbit ||= {});
  window.orbit.getGeoObjectsSelectedO2s = () => __geoObjectsSelectedO2s.slice();
} catch (_) {}

// ——— ГЛОБАЛЬНІ ПОДІЇ ———
try {
  window.addEventListener('orbit:ui-reset', () => {
    geoObjectsResultSeq = 0;
    __resetSelectedO2s();
  });
} catch {}


/**
 * onGeoObjectsCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для підрежиму «Географія → Об’єкти».
 */
export function onGeoObjectsCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getGeoObjectsData(scope);
  // Підпис інфопанелі: «Географія: Об’єкти»
  setModeLabelKeys({
    modeKey: 'panel_title_geo',
    subKey:  'panel_title_geo_objects'
  });

  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('geo_objects:baseline');
  const color2 = getColorForKey(`geo_objects:o2:${++geoObjectsResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // масштабований діаметр кола на мапі
  const baselineRadius   = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const v1 = Number(data?.object1?.valueReal);                         // реальна довжина/висота (м)
  const u1 = data?.object1?.unit || 'm';

  // Завжди оновлюємо внутрішній масштаб
  resetGeoObjectsScale();
  setGeoObjectsBaseline({
    valueReal: v1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло (якщо радіус > 0)
  const baselineId = 'geo_objects_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: О1 — ПОКАЗУЄМО РАДІУС (ключі існують у translations.json)
  const o1RealOk = Number.isFinite(v1) && v1 > 0;
  addGroup({
    id: 'geo_objects_o1',
    title: data?.object1?.name || '',
    color: color1,
    groupType: 'baseline',
    uiLeftLabelKey:  'ui.geo.objects.o1.left',   // ✓ правильний ключ
    uiRightLabelKey: 'ui.geo.objects.o1.right',  // ✓ правильний ключ
  });
  appendVariant({
    id: 'geo_objects_o1',
    variant: 'single',
    realValue: o1RealOk ? v1 : null,
    realUnit:  o1RealOk ? u1 : null,
    // ПРАВИЛЬНО: scaledMeters — РАДІУС
    scaledMeters: baselineRadius
  });
  if (String(data?.object1?.description || '').trim()) {
    setGroupDescription({ id: 'geo_objects_o1', description: data.object1.description });
  }

  // ——— LOCK O1 UI ДО RESET + START SESSION ———
  const baselineValid = o1RealOk && baselineRadius > 0;
  if (baselineValid && scope) {
    const o1group = scope.querySelector('.object1-group');
    if (o1group) {
      o1group.classList.add('is-locked');
      o1group.querySelectorAll('select, input, button, textarea').forEach(el => { el.disabled = true; });
    }
    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}
  }

  // 3) О2: обчислити через калькулятор
  const v2 = Number(data?.object2?.valueReal); // реальна довжина/висота (м)
  const u2 = data?.object2?.unit || 'm';
  const res = addGeoObjectsCircle({ valueReal: v2, unit: u2, color: color2 });

  // 3a) Намалювати коло О2 (якщо радіус валідний)
  const scaledRadiusMeters = res && Number(res.scaledRadiusMeters) > 0
    ? Number(res.scaledRadiusMeters)
    : 0;

  if (scaledRadiusMeters > 0) {
    const id = addGeodesicCircle(scaledRadiusMeters, color2, `geo_objects_r${geoObjectsResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 4) Інфопанель: О2 — ТЕ Ж САМЕ ФОРМАТУВАННЯ (РАДІУС)
  const o2RealOk = Number.isFinite(v2) && v2 > 0;

  const groupId = `geo_objects_o2_${geoObjectsResultSeq}`;
  addGroup({
    id: groupId,
    title: data?.object2?.name || '',
    color: color2,
    groupType: 'item',
    uiLeftLabelKey:  'ui.geo.objects.o1.left',   // ✓ той самий набір підписів
    uiRightLabelKey: 'ui.geo.objects.o1.right',  // ✓ «Масштабована довжина (радіус)»
  });
  appendVariant({
    id: groupId,
    variant: 'single',
    realValue: o2RealOk ? v2 : null,
    realUnit:  o2RealOk ? u2 : null,
    scaledMeters: scaledRadiusMeters,
    invisibleReason: res?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: res?.requiredBaselineMeters ?? null
  });
  if (String(data?.object2?.description || '').trim()) {
    setGroupDescription({ id: groupId, description: data.object2.description });
  }

  __pushSelectedO2(data);

  // Діагностика
  console.log(
    '[mode:geo:objects] O1: L(m)=%s → Rscaled=%s; O2: L(m)=%s → Rscaled=%s',
    o1RealOk ? v1 : '—', baselineRadius,
    o2RealOk ? v2 : '—', scaledRadiusMeters
  );
}
