// full/js/events/luminosity_buttons.js
'use strict';

/**
 * Еталонний обробник для режиму «Світність».
 * Робить рівно те, що описано в Контракті:
 *   1) бере StandardData з адаптера;
 *   2) задає baseline у калькуляторі;
 *   3) додає коло для О2 через калькулятор;
 *   4) викликає системні рендери кіл та інфопанель.
 *
 * Жодних сторонніх залежностей, DOM-хаків чи доступів до інших режимів.
 */

import { getLuminosityData } from '../data/data_luminosity.js';
import { setLuminosityBaseline, addLuminosityCircle, resetLuminosityScale } from '../calc/calculate_luminosity.js';

import { addGroup, appendVariant, setGroupDescription } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

// Лічильник для унікальних id кіл О2
let luminosityResultSeq = 0;

// [NEW] Акумуляція вибраних О2 для серіалізації сцен
const __luminositySelectedO2s = [];
function __pushSelectedO2(data) {
  try {
    const categoryKey = String(data?.object2?.category || data?.object2?.categoryKey || '').trim();
    const name = String(data?.object2?.name || '').trim();
    const objectId = String(data?.object2?.userId || data?.object2?.objectId || data?.object2?.name || '').trim(); // офіційний id або fallback=назва
    if (!categoryKey || !objectId) return;
    __luminositySelectedO2s.push({ categoryKey, objectId, name: name || null });
  } catch {}
}
function __resetSelectedO2s() { __luminositySelectedO2s.length = 0; }
try { (window.orbit ||= {}); window.orbit.getUniversLuminositySelectedO2s = () => __luminositySelectedO2s.slice(); } catch {}

// Скидання лічильника та буфера при повному UI-RESET
try {
  window.addEventListener('orbit:ui-reset', () => {
    luminosityResultSeq = 0;
    __resetSelectedO2s();
  });
} catch {}

/**
 * onLuminosityCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму luminosity.
 */
export function onLuminosityCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getLuminosityData(scope);

  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('luminosity:baseline');
  const color2 = getColorForKey(`luminosity:o2:${++luminosityResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0;
  const l1 = Number(data?.object1?.valueReal);
  const u1 = data?.object1?.unit || 'W';

  resetLuminosityScale(); // чистий стан на кожен розрахунок
  setLuminosityBaseline({
    valueReal: l1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло (якщо діаметр > 0)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'luminosity_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      // підпис: просто назва О1
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

// 2b) Інфопанель (уніфіковане API)
const o1RealOk = Number.isFinite(l1) && l1 > 0;

addGroup({
  id: 'luminosity_o1',
  title: data?.object1?.name || '',
  color: color1,
  groupType: 'baseline',
  uiLeftLabelKey:  'luminosity.labels.o1.left',   // "Світність"
  uiRightLabelKey: 'luminosity.labels.o1.right',  // "Діаметр (площа кола ∝ світності)"
});
appendVariant({
  id: 'luminosity_o1',
  variant: 'single',
  realValue: o1RealOk ? l1 : null,
  realUnit:  o1RealOk ? u1 : null,
  // Для baseline у «Світності» показуємо ДІАМЕТР (м)
  scaledMeters: baselineDiameter
});
if (String(data?.object1?.description || '').trim()) {
  setGroupDescription({ id: 'luminosity_o1', description: data.object1.description });
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

  // 3) О2: обчислити через калькулятор
  const l2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || 'W';
  const res = addLuminosityCircle({
    valueReal: l2,
    unit: u2,
    color: color2
  });

  // 3a) Намалювати коло О2 (якщо радіус валідний)
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `luminosity_r${luminosityResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 4) Інфопанель: результат О2 (уніфіковане API; scaledMeters = ДІАМЕТР)
const o2RealOk = Number.isFinite(l2) && l2 > 0;
const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0 ? 2 * Number(res.scaledRadiusMeters) : 0;

const groupId = `luminosity_o2_${luminosityResultSeq}`;
addGroup({
  id: groupId,
  title: data?.object2?.name || '',
  color: color2,
  groupType: 'item',
  // для item використовуємо ті самі лівий/правий лейбли, що й у baseline
  uiLeftLabelKey:  'luminosity.labels.o1.left',
  uiRightLabelKey: 'luminosity.labels.o1.right',
});
if (String(data?.object2?.description || '').trim()) {
  setGroupDescription({ id: groupId, description: data.object2.description });
}
appendVariant({
  id: groupId,
  variant: 'single',
  realValue: o2RealOk ? l2 : null,
  realUnit:  o2RealOk ? u2 : null,
  scaledMeters: scaledDiameterMeters,
  invisibleReason: res?.tooLarge ? 'tooLarge' : null,
  requiredBaselineMeters: res?.requiredBaselineMeters ?? null
});

// [NEW] запам'ятати вибраний О2
__pushSelectedO2(data);

}
