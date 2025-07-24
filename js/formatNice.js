// js/formatNice.js
// ─────────────────────────────────────────────────────────────
// Конвертує метричні величини у «приємні» значення з ключем одиниці.
// Повертає об’єкт { val: string, unitKey: string }.
// realMeters — число у метрах.

export function formatNice(realMeters) {
  const LY_M = 9.460730472e15;      // 1 світловий рік у метрах

  const THRESHOLDS = [
    { max: 1e-2,    factor: 1e3,                    unitKey: 'unit.mm' },
    { max: 1,       factor: 1e2,                    unitKey: 'unit.cm' },
    { max: 1e3,     factor: 1,                      unitKey: 'unit.m'  },
    { max: 1e6,     factor: 1e-3,                   unitKey: 'unit.km' },
    { max: 1e9,     factor: 1e-6,                   unitKey: 'unit.thousand_km' },
    { max: 1e12,    factor: 1e-9,                   unitKey: 'unit.million_km' },
    { max: 1e15,    factor: 1e-12,                  unitKey: 'unit.billion_km' },
    { max: 1e18,    factor: 1 / LY_M,               unitKey: 'unit.ly' },
    { max: 1e21,    factor: 1 / (1e3 * LY_M),       unitKey: 'unit.thousand_ly' },
    { max: 1e24,    factor: 1 / (1e6 * LY_M),       unitKey: 'unit.million_ly' },
    { max: Infinity,factor: 1 / (1e9 * LY_M),       unitKey: 'unit.billion_ly' }
  ];

  const thr = THRESHOLDS.find(t => realMeters < t.max);
  const val = (realMeters * thr.factor)
                .toFixed(2)
                .replace(/\.00$/, '')
                .replace(/(\.\d)0$/, '');

  return { val, unitKey: thr.unitKey };
}

