// full/js/modes/registry.js
'use strict';

const __modes = new Map();

/** Реєстрація режиму */
export function registerMode(id, descriptor) {
  __modes.set(id, descriptor);
}

/** Отримати режим за id (наприклад, 'univers_distance') */
export function getMode(id) {
  return __modes.get(id);
}

/** Список доступних режимів (на майбутнє) */
export function listModes() {
  return Array.from(__modes.keys());
}
