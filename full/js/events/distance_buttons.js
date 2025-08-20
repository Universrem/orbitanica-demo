// full/js/events/distance_buttons.js
'use strict';

import { getDistanceData } from '../data/data_distance.js';
import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import { setCircleLabelTextById, setCircleLabelKeyById } from '../globe/circles.js';
import {
  getDistanceScale,
  resetDistanceScale,
  setDistanceBaseline,
  addDistanceCircle
} from '../calc/calculate_distance.js';

/**
 * Обробник натискання "Розрахувати" для режиму "Відстань".
 */
export function onDistanceCalculate(ctx = {}) {
  const data = getDistanceData();
  if (!data) return;

  // 1) БАЗА (ОБ'ЄКТ 1) — масштабуємо і, якщо можливо, малюємо базове коло
  const color1 = getColorForKey(`obj:${data.object1.name || data.object1.libIndex}`);
  const baselineId = setDistanceBaseline(
    data.object1.diameterReal,
    data.object1.unit,
    data.object1.diameterScaled,
    color1
  );

  // Інфопанель — baseline (діаметр на мапі = те, що ввів користувач)
  setBaselineResult({
    libIndex: data.object1.libIndex,
    realValue: data.object1.diameterReal,
    realUnit: data.object1.unit,
    scaledMeters: data.object1.diameterScaled, // на мапі — ДІАМЕТР довідкового кола О1
    name: data.object1.name,
    description: data.object1.description,
    color: color1
  });

  // Лейбл для базового кола (якщо він намалювався)
  if (baselineId) {
    setCircleLabelTextById(baselineId, data.object1.name);
    setCircleLabelKeyById(
      baselineId,
      Number.isInteger(data.object1.libIndex) && data.object1.libIndex >= 0
        ? { type: 'lib', libIndex: data.object1.libIndex }
        : { type: 'custom', customName: data.object1.name }
    );
  }

  // 🔒 Заблокувати сектор О1 (аналог "Діаметрів")
  const g1 = ctx.object1Group;
  if (g1 && !g1.classList.contains('is-locked')) {
    g1.classList.add('is-locked');
    g1.querySelectorAll('select, input, button').forEach((el) => {
      const act = el.dataset?.action || el.id || '';
      if (act === 'calculate' || act === 'reset') return;
      el.disabled = true;
    });
  }

  // Позначити старт сесії (як у "Діаметрах")
  if (!window.__orbitSessionActive) {
    window.__orbitSessionActive = true;
    window.dispatchEvent(new CustomEvent('orbit:session-start'));
  }

  // 2) ОБ'ЄКТ 2 — коло за ВІДСТАННЮ (радіус = distance_real * scale)
  if (data.object2) {
    const color2 = getColorForKey(`obj:${data.object2.name || data.object2.libIndex}`);
    const res = addDistanceCircle(data.object2.distanceReal, data.object2.unit, color2);

    // Інфопанель: праворуч показуємо значення у метрах на мапі.
    // У "Відстані" це РАДІУС (у майбутньому додамо i18n-суфікс "(радіус)").
    addResult({
      libIndex: data.object2.libIndex,
      realValue: data.object2.distanceReal,
      realUnit: data.object2.unit,
      scaledMeters: res.scaledRadiusMeters,      // радіус на мапі
      name: data.object2.name,
      description: data.object2.description,
      color: color2,
      invisibleReason: res.tooLarge ? 'tooLarge' : null,
      requiredBaselineMeters: res.requiredBaselineMeters || null
    });

    // Лейбл/точка на колі (якщо намалювали)
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
