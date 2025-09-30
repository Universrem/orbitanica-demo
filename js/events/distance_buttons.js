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
import { addGroup, appendVariant, setGroupDescription, setModeLabelKeys } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

// [NEW] Акумуляція вибраних О2 для збереження сцени
const __distanceSelectedO2s = [];

function __pushSelectedO2(data) {
  try {
    const cat = String(data?.object2?.category || '').trim();
    const name = String(data?.object2?.name || '').trim();
    const objectId = String(data?.object2?.userId || data?.object2?.name || '').trim(); // офіційний id або fallback=назва
    if (!cat || !objectId) return;
    __distanceSelectedO2s.push({ categoryKey: cat, objectId, name: name || null });
  } catch (_) {}
}

function __resetSelectedO2s() {
  __distanceSelectedO2s.length = 0;
}

// Публічний геттер для серіалізатора
try {
  (window.orbit ||= {});
  window.orbit.getUniversDistanceSelectedO2s = () => __distanceSelectedO2s.slice();
} catch (_) {}

// Лічильник для унікальних id кіл О2
// Скидання лічильника та вибраних О2 на глобальний UI-RESET
try {
  window.addEventListener('orbit:ui-reset', () => {
    distanceResultSeq = 0;
    __resetSelectedO2s();
  });
} catch {}

let distanceResultSeq = 0;

/**
 * onDistanceCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму distance.
 */
export function onDistanceCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getDistanceData(scope);
  // Підпис інфопанелі: «Всесвіт: Відстань»
  setModeLabelKeys({
    modeKey: 'panel_title_univers',
    subKey:  'panel_title_univers_distance'
  });

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

// 2b) Інфопанель (уніфіковане API)
const o1RealOk = Number.isFinite(realD1) && realD1 > 0;

addGroup({
  id: 'distance_o1',
  title: data?.object1?.name || '',
  color: color1,
  groupType: 'baseline',
  // baseline у «Відстані» — це діаметри
  uiLeftLabelKey:  'diameter.labels.o1.left',   // "Діаметр"
  uiRightLabelKey: 'diameter.labels.o1.right',  // "Масштабований діаметр"
});
appendVariant({
  id: 'distance_o1',
  variant: 'single',
  realValue: o1RealOk ? realD1 : null,
  realUnit:  o1RealOk ? u1 : null,
  // Для baseline показуємо ДІАМЕТР (м)
  scaledMeters: baselineDiameter
});
if (String(data?.object1?.description || '').trim()) {
  setGroupDescription({
    id: 'distance_o1',
    description: data.object1.description
  });
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

const groupId = `distance_o2_${distanceResultSeq}`;

addGroup({
  id: groupId,
  title: data?.object2?.name || '',
  color: color2,
  groupType: 'item',
  uiLeftLabelKey:  'distance.labels.o2.left',   // "Відстань до Землі"
  uiRightLabelKey: 'distance.labels.o2.right',  // "Масштабована відстань (радіус)"
});
if (String(data?.object2?.description || '').trim()) {
  setGroupDescription({
    id: groupId,
    description: data.object2.description
  });
}

appendVariant({
  id: groupId,
  variant: 'single',
  realValue: o2RealOk ? dist2 : null,
  realUnit:  o2RealOk ? u2 : null,
  // ВАЖЛИВО: для О2 у «Відстані» scaledMeters = РАДІУС
  scaledMeters: (res && Number(res.scaledRadiusMeters) > 0) ? Number(res.scaledRadiusMeters) : 0,
  invisibleReason: res?.tooLarge ? 'tooLarge' : null,
  requiredBaselineMeters: res?.requiredBaselineMeters ?? null
});


  // Запам'ятати щойно доданий О2 для серіалізації сцени
__pushSelectedO2(data);

  // Консоль для діагностики
  console.log(
    '[mode:distance] D1=%sm; realD1=%s%s; dist2=%s%s → D2=%sm',
    baselineDiameter,
    o1RealOk ? realD1.toLocaleString() : '—', o1RealOk ? u1 : '',
    o2RealOk ? dist2.toLocaleString() : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
