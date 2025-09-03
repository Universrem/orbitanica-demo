// full/js/utils/unit_converter.js

let baseUnitsData = {};

/**
 * Завантажує base_units.json у памʼять
 */
export async function loadBaseUnits() {
  try {
    const response = await fetch('/js/utils/base_units.json');
    baseUnitsData = await response.json();
  } catch (err) {
    console.error('❌ Не вдалося завантажити base_units.json', err);
    baseUnitsData = {};
  }
}

/**
 * Повертає базову одиницю для заданого режиму
 * @param {string} modeKey - Напр. "diameter", "distance", "mass"
 * @returns {string|null}
 */
export function getBaseUnit(modeKey) {
  return baseUnitsData[modeKey]?.base || null;
}

/**
 * Конвертує значення у базову одиницю режиму
 * @param {number} value - числове значення
 * @param {string} fromUnit - початкова одиниця (має бути у base_units.json)
 * @param {string} modeKey - режим
 * @returns {number}
 */
export function convertToBase(value, fromUnit, modeKey) {
  const mode = baseUnitsData[modeKey];
  if (!mode) throw new Error(`Невідомий режим: ${modeKey}`);
  const factor = mode.units[fromUnit];
  if (factor === undefined) throw new Error(`Невідома одиниця: ${fromUnit}`);
  return value * factor;
}

/**
 * Конвертує значення з однієї одиниці в іншу в межах режиму
 * @param {number} value - числове значення
 * @param {string} fromUnit - початкова одиниця
 * @param {string} toUnit - кінцева одиниця
 * @param {string} modeKey - режим
 * @returns {number}
 */
export function convertUnit(value, fromUnit, toUnit, modeKey) {
  const mode = baseUnitsData[modeKey];
  if (!mode) throw new Error(`Невідомий режим: ${modeKey}`);
  const fromFactor = mode.units[fromUnit];
  const toFactor = mode.units[toUnit];
  if (fromFactor === undefined || toFactor === undefined) {
    throw new Error(`Невідомі одиниці: ${fromUnit} → ${toUnit}`);
  }
  return (value * fromFactor) / toFactor;
}

/**
 * Повертає список доступних одиниць для заданого режиму
 * @param {string} modeKey - Напр. "diameter", "mass"
 * @returns {string[]}
 */
export function listUnits(modeKey) {
  const mode = baseUnitsData[modeKey];
  if (!mode) return [];
  return Object.keys(mode.units);
}
