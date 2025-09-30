// full/js/events/diameter_buttons.js
'use strict';

/**
 * Обробник для режиму «Діаметри».
 * Побудовано за еталоном «Історія»:
 *  - є локальний буфер обраних О2 + публічний геттер (для серіалізатора);
 *  - стабільний лічильник результатів для О2 (кольори/ID кіл);
 *  - на глобальний UI-RESET скидаємо лічильник; буфер О2 чистимо лише коли це НЕ "перемальовування";
 *  - під час "перемальовування" (repaint) НЕ пишемо в інфопанель і НЕ пушимо О2 у буфер → без дублів.
 */

import { getDiameterData } from '../data/data_diameter.js';
import { setDiameterBaseline, addDiameterCircle, resetDiameterScale } from '../calc/calculate_diameter.js';
import { addGroup, appendVariant, setGroupDescription, setModeLabelKeys } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import { addGeodesicCircle, setCircleLabelTextById } from '../globe/circles.js';

// ——— СТАН СЕСІЇ ———

// Лічильник для унікальних id/кольорів О2 (скидається на UI-RESET)
let diameterResultSeq = 0;

// Прапорець «йде перемальовування сцени» (аплаєр має кидати orbit:repaint-start/end)
let __isRepaint = false;

// Локальний список вибраних О2 (накопичується під час створення сцени)
const __diameterSelectedO2s = [];

// Додати один О2 до списку (без побічних ефектів)
function __pushSelectedO2(item) {
  try {
    const categoryKey = String(item?.object2?.category || item?.object2?.categoryKey || '').trim();
    const name = String(item?.object2?.name || '').trim();
    const objectId = String(
      item?.object2?.userId || item?.object2?.objectId || item?.object2?.name || ''
    ).trim(); // офіц. id або fallback=назва
    if (!categoryKey || !objectId) return;
    __diameterSelectedO2s.push({ categoryKey, objectId, name: name || null });
  } catch (_) {}
}

// Очистити список (на нову сцену)
function __resetSelectedO2s() {
  __diameterSelectedO2s.length = 0;
}

// Публічний геттер для серіалізатора univers_diameter_serializer.js
try {
  (window.orbit ||= {});
  window.orbit.getUniversDiameterSelectedO2s = () => __diameterSelectedO2s.slice();
} catch (_) {}

// ——— ГЛОБАЛЬНІ ПОДІЇ ———
try {
  window.addEventListener('orbit:ui-reset', () => {
    diameterResultSeq = 0;
    __resetSelectedO2s();
  });
} catch {}


/**
 * onDiameterCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму «діаметри».
 */
export function onDiameterCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getDiameterData(scope);
// Підпис режиму: використовуємо наявні ключі перекладу
// "Всесвіт: Діаметр" / "Universe: Diameter" / "Universo: Diámetro"
setModeLabelKeys({
  modeKey: 'panel_title_univers',
  subKey: 'panel_title_univers_diameter'
});



  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('diameter:baseline');
  const color2 = getColorForKey(`diameter:o2:${++diameterResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // D1 (м) — масштабований діаметр на мапі
  const v1 = Number(data?.object1?.diameterReal);                      // V1 (м) — реальний діаметр
  const u1 = data?.object1?.unit || 'km';

  // Завжди оновлюємо внутрішній масштаб (геометрія кола залежить від центру)
  resetDiameterScale();
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

  // 2b) Інфопанель: baseline (лише якщо це НЕ перевідмальовування)
  const o1RealOk = Number.isFinite(v1) && v1 > 0;
 addGroup({
  id: 'diameter_o1',
  title: data?.object1?.name || '',
  color: color1,
  groupType: 'baseline',
  uiLeftLabelKey:  'diameter.labels.o1.left',
  uiRightLabelKey: 'diameter.labels.o1.right',
});
appendVariant({
  id: 'diameter_o1',
  variant: 'single',
  realValue: o1RealOk ? v1 : null,
  realUnit:  o1RealOk ? u1 : null,
  scaledMeters: baselineDiameter
});
if (String(data?.object1?.description || '').trim()) {
  setGroupDescription({ id: 'diameter_o1', description: data.object1.description });
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
  const v2 = Number(data?.object2?.diameterReal); // V2 (м)
  const u2 = data?.object2?.unit || 'km';
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

  // 4) Інфопанель: результат О2 (лише якщо це НЕ перевідмальовування)
  const o2RealOk = Number.isFinite(v2) && v2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

const groupId = `diameter_o2_${diameterResultSeq}`;
addGroup({
  id: groupId,
  title: data?.object2?.name || '',
  color: color2,
  groupType: 'item',
  uiLeftLabelKey:  'diameter.labels.o1.left',
  uiRightLabelKey: 'diameter.labels.o1.right',
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
  '[mode:diameter] O1: D(%s)=%s → Dscaled(m)=%s; O2: V(%s)=%s → Dscaled(m)=%s',
  o1RealOk ? u1 : '-', o1RealOk ? v1 : '—', baselineDiameter,
  o2RealOk ? u2 : '-', o2RealOk ? v2 : '—', scaledDiameterMeters
);


}
