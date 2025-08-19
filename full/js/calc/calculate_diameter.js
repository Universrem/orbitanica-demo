//full/js/calc/calculate_diameter.js

'use strict';

import { convertUnit } from '../utils/unit_converter.js';
import { addGeodesicCircle } from '../globe/circles.js';
import { getCurrentLang } from '../i18n.js';
import { getUniverseLibrary } from '../data/data_diameter.js';

// Поточний масштаб (зберігається між викликами)
let currentScale = null;
let __baselineId = null;

// Скидання внутрішнього масштабу на глобальний reset UI
window.addEventListener('orbit:ui-reset', () => {
  currentScale = null;
  __baselineId = null;
});

export function getCurrentScale() {
  return currentScale;
}

// Публічне скидання масштабу
export function resetDiameterScale() {
  currentScale = null;
}

/**
 * Розраховує масштаб і (опційно) малює коло для Об’єкта 1
 * @param {number} realDiameterVal      Реальний діаметр Об’єкта 1
 * @param {string} realDiameterUnit     Одиниця (напр., "km")
 * @param {number} circleDiameterMeters Діаметр кола на землі (м)
 * @param {string} [color='rgba(255,0,0,0.8)']  Колір кола
 */
export function setObject1Scale(realDiameterVal, realDiameterUnit, circleDiameterMeters, color = 'rgba(255,0,0,0.8)') {
  const realDiameterMeters = Number(convertUnit(realDiameterVal, realDiameterUnit, 'm', 'diameter'));
  const circleDM = Number(circleDiameterMeters);

  // Межа візуалізації: якщо радіус базового кола > π·R — не малюємо (масштаб залишається)
const R_EARTH = 6_371_000;
const LIM_RADIUS = Math.PI * R_EARTH;
const EPS_M = 1;
if ((circleDM / 2) > (LIM_RADIUS + EPS_M)) {
  __baselineId = null;
  return null; // інфопанель покаже базу як є, але без геометрії
}


  if (!isFinite(realDiameterMeters) || realDiameterMeters <= 0 || !isFinite(circleDM) || circleDM <= 0) {
    console.warn('[setObject1Scale] invalid inputs', { realDiameterVal, realDiameterUnit, circleDiameterMeters });
    currentScale = null;
    return;
  }

  // Масштаб = (діаметр кола) / (реальний діаметр)
  currentScale = circleDM / realDiameterMeters;

  // Малюємо коло Об’єкта 1 (радіус = половина діаметра)
  try {
    __baselineId = addGeodesicCircle(circleDM / 2, color, __baselineId);
    return __baselineId;
  } catch (e) {
    console.error('[setObject1Scale] draw error:', e);
    return null;
  }
}

/**
 * Малює коло для Об’єкта 2 з використанням масштабу Об’єкта 1
 * @param {number} realDiameterVal  Реальний діаметр Об’єкта 2
 * @param {string} realDiameterUnit Одиниця (напр., "km")
 * @param {string} color            Колір кола
 */
export function addObject2Circle(realDiameterVal, realDiameterUnit, color) {
  if (currentScale == null || !(currentScale > 0)) {
    console.error('❌ Спочатку потрібно задати масштаб через setObject1Scale()');
    return;
  }

  const realDiameterMeters = Number(convertUnit(realDiameterVal, realDiameterUnit, 'm', 'diameter'));
  if (!isFinite(realDiameterMeters) || realDiameterMeters <= 0) {
    console.warn('[addObject2Circle] invalid real diameter', { realDiameterVal, realDiameterUnit });
    return;
  }

  // Масштабований діаметр кола (м)
  const circleDiameterMeters = realDiameterMeters * currentScale;
  if (!(circleDiameterMeters > 0)) {
    console.warn('[addObject2Circle] computed circle diameter is non-positive', { circleDiameterMeters });
    return;
  }

  try {
    return addGeodesicCircle(circleDiameterMeters / 2, color);
  } catch (e) {
    console.error('[addObject2Circle] draw error:', e);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
 * Хелпери для інфопанелі: назва та опис з юзер-об’єктів
 * з фолбеком на офіційну бібліотеку за libIndex.
 * Використовуй їх там, де збирається HTML картки результатів.
 * ──────────────────────────────────────────────────────────── */

function libObjByIndex(idx) {
  const lib = (typeof getUniverseLibrary === 'function') ? getUniverseLibrary() : [];
  return (typeof idx === 'number' && idx >= 0 && lib[idx]) ? lib[idx] : null;
}

/**
 * Повертає коректну назву для відображення.
 * @param {{name?:string, libIndex?:number}} obj
 */
export function displayNameFor(obj) {
  const lang = getCurrentLang();
  if (obj && typeof obj.name === 'string' && obj.name) return obj.name; // юзер-об'єкт
  const lo = obj ? libObjByIndex(obj.libIndex) : null;
  return lo ? (lo[`name_${lang}`] || '') : '';
}

/**
 * Повертає коректний опис для відображення.
 * @param {{description?:string, libIndex?:number}} obj
 */
export function displayDescFor(obj) {
  const lang = getCurrentLang();
  if (obj && typeof obj.description === 'string' && obj.description) return obj.description; // юзер-опис
  const lo = obj ? libObjByIndex(obj.libIndex) : null;
  return lo ? (lo[`description_${lang}`] || '') : '';
}
