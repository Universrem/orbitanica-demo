// full/js/events/luminosity_buttons.js
'use strict';

import { getLuminosityData } from '../data/data_luminosity.js';
import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import { setCircleLabelTextById, setCircleLabelKeyById } from '../globe/circles.js';
import { setLuminosityBaseline, addLuminosityCircle } from '../calc/calculate_luminosity.js';

export function onLuminosityCalculate(ctx = {}) {
  const data = getLuminosityData();
  if (!data || !data.object1) return;

  // 1) БАЗА (О1)
  const color1 = getColorForKey(`lumi:${data.object1.name || data.object1.libIndex}`);
  const baselineId = setLuminosityBaseline(
    data.object1.luminosityReal,
    data.object1.unit,
    data.object1.diameterScaled,
    color1
  );

  setBaselineResult({
    libIndex: data.object1.libIndex,
    realValue: data.object1.luminosityReal,
    realUnit: data.object1.unit,
    scaledMeters: data.object1.diameterScaled,
    name: data.object1.name,
    description: data.object1.description,
    color: color1
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

  // 🔒 заблокувати поле О1 (до Reset)
  const g1 = ctx.object1Group;
  if (g1) {
    g1.classList.add('is-locked');
    g1.querySelectorAll('select, input, button').forEach(el => {
      const act = el.dataset?.action || el.id;
      if (act === 'calculate' || act === 'reset') return;
      el.disabled = true;
    });
  }

  if (!window.__orbitSessionActive) {
    window.__orbitSessionActive = true;
    window.dispatchEvent(new CustomEvent('orbit:session-start'));
  }

  // 2) О2
  if (data.object2) {
    const color2 = getColorForKey(`lumi:${data.object2.name || data.object2.libIndex}`);
    const res = addLuminosityCircle(
      data.object2.luminosityReal,
      data.object2.unit,
      color2
    );

    addResult({
      libIndex: data.object2.libIndex,
      realValue: data.object2.luminosityReal,
      realUnit: data.object2.unit,
      scaledMeters: res.scaledDiameterMeters || null,
      name: data.object2.name,
      description: data.object2.description,
      color: color2,
      invisibleReason: res.tooLarge ? 'tooLarge' : null,
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
