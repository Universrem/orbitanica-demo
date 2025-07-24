// js/converter.js
// ──────────────────────────────────────────────
// Переводить довільне значення та одиницю у кілометри.
// Підтримує km, m, AU, ly, kly, Mly, Gly, pc, kpc, Mpc, Gpc.

const KM_PER_AU  = 149_597_870.7;
const KM_PER_LY  = 9_460_730_472_580.8; // метри → км
const KM_PER_PC  = 3.08567758149e13;

const UNIT_MAP = {
  km :       1,
  m  :       1 / 1_000,
  AU :       KM_PER_AU,
  ly :       KM_PER_LY,
  kly:       KM_PER_LY * 1_000,
  Mly:       KM_PER_LY * 1_000_000,
  Gly:       KM_PER_LY * 1_000_000_000,
  pc :       KM_PER_PC,
  kpc:       KM_PER_PC * 1_000,
  Mpc:       KM_PER_PC * 1_000_000,
  Gpc:       KM_PER_PC * 1_000_000_000
};

/**
 * @param {number} value   — числове значення
 * @param {string} unit    — одиниця (має бути ключ у UNIT_MAP, регістр чутливий)
 * @returns {number}       — значення в кілометрах
 */
export function toKilometres(value, unit) {
  const k = UNIT_MAP[unit];
  if (!k) {
    console.error(`[converter] Невідома одиниця "${unit}" → повертаю 0`);
    return 0;
  }
  return value * k;
}

