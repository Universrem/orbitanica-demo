// full/js/events/diameter_buttons.js
'use strict';

import { getDiameterData } from '../data/data_diameter.js';
import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import { setCircleLabelTextById, setCircleLabelKeyById } from '../globe/circles.js';
import { loadBaseUnits } from '../utils/unit_converter.js';
import { setObject1Scale, addObject2Circle } from '../calc/calculate_diameter.js';

/**
 * Натискання «Розрахувати» у розділі «Діаметр».
 */
export function onDiameterCalculate(ctx = {}) {
    try { loadBaseUnits(); } catch {}
  const data = getDiameterData();
  if (!data) return;

  // 1) Об’єкт 1: масштаб і базове коло
  const color1 = getColorForKey(`diam:${data.object1.name || data.object1.libIndex}`);
  const baselineId = setObject1Scale(
    data.object1.diameterReal,
    data.object1.unit,
    data.object1.diameterScaled,
    color1
  );

  setBaselineResult({
    libIndex: data.object1.libIndex,
    realValue: data.object1.diameterReal,
    realUnit: data.object1.unit,
    scaledMeters: data.object1.diameterScaled,
    name: data.object1.name,
    description: data.object1.description,
    color: color1,
    uiLeftLabelKey: 'diameter.labels.o1.left',
    uiRightLabelKey: 'diameter.labels.o1.right',
  });

  if (baselineId) {
    setCircleLabelTextById(baselineId, data.object1.name);
    setCircleLabelKeyById(
      baselineId,
      Number.isInteger(data.object1.libIndex) && data.object1.libIndex >= 0
        ? { type: 'lib', libIndex: data.object1.libIndex }
        : { type: 'custom', customName: data.object1.name }
    );
  }

  // 🔒 Заблокувати поля Об’єкта 1 до «Скинути»
  const g1 = ctx.object1Group;
  if (g1 && !g1.classList.contains('is-locked')) {
    g1.classList.add('is-locked');
    g1.querySelectorAll('select, input, button').forEach((el) => {
      const act = el.dataset?.action || el.id || '';
      if (act === 'calculate' || act === 'reset') return;
      el.disabled = true;
    });
  }

  // Позначити початок сесії
  if (!window.__orbitSessionActive) {
    window.__orbitSessionActive = true;
    window.dispatchEvent(new CustomEvent('orbit:session-start'));
  }

  // 2) Об’єкт 2: коло за діаметром із перевіркою межі
  // 2) Об’єкт 2: коло за діаметром (перевірка й підказка робляться у файлі розрахунків)
  if (data.object2) {
    const color2 = getColorForKey(`diam:${data.object2.name || data.object2.libIndex}`);
    const res = addObject2Circle(data.object2.diameterReal, data.object2.unit, color2);

    addResult({
      libIndex: data.object2.libIndex,
      realValue: data.object2.diameterReal,
      realUnit: data.object2.unit,
      scaledMeters: res.scaledDiameterMeters,             // діаметр на мапі
      name: data.object2.name,
      description: data.object2.description,
      color: color2,
      invisibleReason: res.tooLarge ? 'tooLarge' : null,  // уніфіковано з «Відстанню»
      requiredBaselineMeters: res.requiredBaselineMeters || null
    });

    if (res.id) {
      setCircleLabelTextById(res.id, data.object2.name);
      setCircleLabelKeyById(
        res.id,
        Number.isInteger(data.object2.libIndex) && data.object2.libIndex >= 0
          ? { type: 'lib', libIndex: data.object2.libIndex }
          : { type: 'custom', customName: data.object2.name }
      );
    }
  }

}
