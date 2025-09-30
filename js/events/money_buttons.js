// /full/js/events/money_buttons.js
'use strict';

/**
 * Обробник для режиму «Гроші».
 * Побудовано за еталоном «Діаметри»:
 *  - є локальний буфер обраних О2 + публічний геттер (для серіалізатора);
 *  - стабільний лічильник результатів для О2 (кольори/ID кіл);
 *  - на глобальний UI-RESET скидаємо лічильник і буфер О2.
 */

import { getMoneyData } from '../data/data_money.js';
import { setMoneyBaseline, addMoneyCircle, resetMoneyScale } from '../calc/calculate_money.js';
import { addGroup, appendVariant, setGroupDescription, setModeLabelKeys } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

// ——— СТАН СЕСІЇ ———

// Лічильник для унікальних id/кольорів О2 (скидається на UI-RESET)
let moneyResultSeq = 0;

// Локальний список вибраних О2 (накопичується під час створення сцени)
const __moneySelectedO2s = [];

// Додати один О2 до списку (без побічних ефектів)
function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim();
    const objectId = String(
      item?.object2?.userId || item?.object2?.objectId || item?.object2?.name || ''
    ).trim(); // офіц. id або fallback=назва
    if (!categoryKey || !objectId) return;
    __moneySelectedO2s.push({ categoryKey, objectId, name: name || null });
  } catch (_) {}
}

// Публічний геттер для серіалізатора money_serializer.js
try {
  (window.orbit ||= {});
  window.orbit.getMoneySelectedO2s = () => __moneySelectedO2s.slice();
} catch (_) {}

// ——— ГЛОБАЛЬНІ ПОДІЇ ———
try {
  window.addEventListener('orbit:ui-reset', () => {
    moneyResultSeq = 0;
    __moneySelectedO2s.length = 0;
  });
} catch {}


/**
 * onMoneyCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму «гроші».
 */
export function onMoneyCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getMoneyData(scope);
  // Підпис інфопанелі: «Гроші»
  setModeLabelKeys({ modeKey: 'panel_title_money' });

  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('money:baseline');
  const color2 = getColorForKey(`money:o2:${++moneyResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // D1 (м) — масштабований діаметр на мапі
  const v1 = Number(data?.object1?.valueReal);                         // реальна сума
  const u1 = data?.object1?.unit || 'USD';

  resetMoneyScale();
  setMoneyBaseline({
    valueReal: v1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло (якщо діаметр > 0)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'money_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель: baseline
  const o1RealOk = Number.isFinite(v1) && v1 > 0;
  addGroup({
    id: 'money_o1',
    title: data?.object1?.name || '',
    color: color1,
    groupType: 'baseline',
    uiLeftLabelKey:  'ui.money.o1.left',
    uiRightLabelKey: 'ui.money.o1.right',
  });
  appendVariant({
    id: 'money_o1',
    variant: 'single',
    realValue: o1RealOk ? v1 : null,
    realUnit:  o1RealOk ? u1 : null,
    scaledMeters: baselineDiameter
  });
  if (String(data?.object1?.description || '').trim()) {
    setGroupDescription({ id: 'money_o1', description: data.object1.description });
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
  const v2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || 'USD';
  const res = addMoneyCircle({
    valueReal: v2,
    unit: u2,
    color: color2
  });

  // 3a) Намалювати коло О2 (якщо радіус валідний)
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `money_r${moneyResultSeq}`);
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

  const groupId = `money_o2_${moneyResultSeq}`;
  addGroup({
    id: groupId,
    title: data?.object2?.name || '',
    color: color2,
    groupType: 'item',
    uiLeftLabelKey:  'ui.money.o1.left',
    uiRightLabelKey: 'ui.money.o1.right',
  });
  appendVariant({
    id: groupId,
    variant: 'single',
    realValue: o2RealOk ? v2 : null,
    realUnit:  o2RealOk ? u2 : null,
    scaledMeters: scaledDiameterMeters,
    invisibleReason: res?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: res?.requiredBaselineMeters ?? null
  });
  if (String(data?.object2?.description || '').trim()) {
    setGroupDescription({ id: groupId, description: data.object2.description });
  }

  __pushSelectedO2(data);

  // Консоль для діагностики
  console.log(
    '[mode:money] O1: V=%s%s → Dscaled=%s; O2: V=%s%s → Dscaled=%s',
    o1RealOk ? v1 : '—', o1RealOk ? u1 : '',
    baselineDiameter,
    o2RealOk ? v2 : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
