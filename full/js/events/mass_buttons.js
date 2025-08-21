// full/js/events/mass_buttons.js
'use strict';

import { getMassData } from '../data/data_mass.js';
import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import { setCircleLabelTextById, setCircleLabelKeyById } from '../globe/circles.js';
import { setMassBaseline, addMassCircle } from '../calc/calculate_mass.js';

export function onMassCalculate(ctx = {}) {
  const data = getMassData();
  if (!data || !data.object1) return;

  // 1) БАЗА (О1): фіксуємо масштаб і, якщо можна, малюємо базове коло
  const color1 = getColorForKey(`mass:${data.object1.name || data.object1.libIndex}`);
  const baselineId = setMassBaseline(
    data.object1.massReal,
    data.object1.unit,
    data.object1.diameterScaled,
    color1
  );

  // Інфопанель — підписи лише з ключів словника (без дефолтів)
  setBaselineResult({
    libIndex: data.object1.libIndex,
    realValue: data.object1.massReal,
    realUnit: data.object1.unit,
    scaledMeters: data.object1.diameterScaled, // на мапі — ДІАМЕТР довідкового кола О1
    name: data.object1.name,
    description: data.object1.description,
    color: color1,
    uiLeftLabelKey: 'mass.labels.o1.left',
    uiRightLabelKey: 'mass.labels.o1.right'
  });

  // Лейбл для базового кола (якщо намалювали)
  if (baselineId) {
    setCircleLabelTextById(baselineId, data.object1.name);
    setCircleLabelKeyById(
      baselineId,
      Number.isInteger(data.object1.libIndex) && data.object1.libIndex >= 0
        ? { type: 'lib', libIndex: data.object1.libIndex }
        : { type: 'custom', customName: data.object1.name }
    );
  }

  // 🔒 Заблокувати сектор О1 до «Скинути»
  const g1 = ctx.object1Group;
  if (g1) {
    g1.classList.add('is-locked');
    g1.querySelectorAll('select, input, button').forEach(el => {
      const act = el.dataset?.action || el.id;
      if (act === 'calculate' || act === 'reset') return;
      el.disabled = true;
    });
  }

  // Позначити старт сесії
  if (!window.__orbitSessionActive) {
    window.__orbitSessionActive = true;
    window.dispatchEvent(new CustomEvent('orbit:session-start'));
  }

  // 2) О2 — масштабуємо діаметр за масою і, якщо в межах, малюємо коло
  if (data.object2) {
    const color2 = getColorForKey(`mass:${data.object2.name || data.object2.libIndex}`);
    const res = addMassCircle(
      data.object2.massReal,
      data.object2.unit,
      color2
    );

    addResult({
      libIndex: data.object2.libIndex,
      realValue: data.object2.massReal,
      realUnit: data.object2.unit,
      scaledMeters: res.scaledDiameterMeters || null, // діаметр на мапі
      name: data.object2.name,
      description: data.object2.description,
      color: color2,
      invisibleReason: res.tooLarge ? 'tooLarge' : null,
      requiredBaselineMeters: res.requiredBaselineMeters || null
      // Підписи для О2 не передаємо — як і узгоджено для цього режиму
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
