// full/js/data/data_distance.js
'use strict';

import { getCurrentLang } from '../i18n.js';
import { getStore } from '../userObjects/api.js';
import { getUniverseLibrary } from './universe.js';

// ── хелпери читання значень з різних форматів ─────────────────────────────

function diamVal(o) {
  if (!o) return null;
  if (typeof o.diameter === 'number') return o.diameter;                       // старий формат
  if (o.diameter && typeof o.diameter.value === 'number') return o.diameter.value; // новий формат
  return null;
}
function diamUnit(o) {
  if (!o) return null;
  if (o.diameter && typeof o.diameter.unit === 'string') return o.diameter.unit; // новий формат
  if (o.unit) return o.unit;
  if (o.diameter_unit) return o.diameter_unit;
  if (o.diameterUnit)  return o.diameterUnit;
  return 'km';
}

function distVal(o) {
  if (!o) return null;
  if (o.distance_to_earth && typeof o.distance_to_earth.value === 'number') return o.distance_to_earth.value;
  if (o.distance && typeof o.distance.value === 'number') return o.distance.value; // допустимо для юзер-об’єктів
  return null;
}
function distUnit(o) {
  if (!o) return null;
  if (o.distance_to_earth && typeof o.distance_to_earth.unit === 'string') return o.distance_to_earth.unit;
  if (o.distance && typeof o.distance.unit === 'string') return o.distance.unit;   // допустимо для юзер-об’єктів
  return 'km';
}

// ОПИС для юзер-об’єкта з урахуванням мов
function userDesc(u, lang) {
  return (typeof u?.description === 'string' && u.description)
      || u?.description_i18n?.[lang]
      || u?.description_i18n?.[u?.originalLang]
      || '';
}

// ── головна функція ─────────────────────────────────────────────────────────

/**
 * Повертає дані для розрахунку режиму "Відстань".
 * О1 (еталон) — зі списку distObject1 (офіційна бібліотека), беремо його РЕАЛЬНИЙ діаметр.
 * О2 — з категорії distCategoryObject2 та списку distObject2 (офіційні + юзер), беремо РЕАЛЬНУ distance_to_earth.
 */
export function getDistanceData() {
  const lang = getCurrentLang();
  const lib  = getUniverseLibrary() || [];

  // Поля DOM
  const object1   = document.getElementById('distObject1')?.value;
  const input1    = parseFloat(document.getElementById('distCircleObject1')?.value);

  const category2 = document.getElementById('distCategoryObject2')?.value;
  const object2   = document.getElementById('distObject2')?.value;

  // Перевірка обов'язкових для старту полів О1
  if (!object1 || isNaN(input1)) {
    return null;
  }

  // ── О1: шукаємо ТІЛЬКИ в офіційній бібліотеці за назвою поточною мовою
  let idx1 = lib.findIndex(o => o[`name_${lang}`] === object1);
  let obj1 = idx1 >= 0 ? lib[idx1] : null;

  // Якщо в офіційного О1 немає діаметра — вважатимемо, що не можемо будувати масштаб
  if (!obj1 || diamVal(obj1) == null) {
    return null;
  }

  // ── О2: пріоритет юзер-об’єктів → якщо нема, беремо з офіційних
  let idx2 = -1;
  let obj2 = null;

  // 1) Юзер-об’єкт (mode='distance')
  try {
    const store = getStore();
    const u2 = store.getByName('distance', object2, category2);
    if (u2) {
      obj2 = {
        user: true,
        name:
          u2.name ||
          u2.name_i18n?.[lang] ||
          u2.name_i18n?.[u2.originalLang] || '',
        category:
          u2.category ||
          u2.category_i18n?.[lang] ||
          u2.category_i18n?.[u2.originalLang] || '',
        distance_to_earth: {
          value: u2.attrs?.distance_to_earth?.value ?? u2.attrs?.distance?.value,
          unit:  u2.attrs?.distance_to_earth?.unit  ?? u2.attrs?.distance?.unit
        },
        description: userDesc(u2, lang)
      };
    }
  } catch {}

  // 2) Офіційний
  if (!obj2 && object2) {
    idx2 = lib.findIndex(o => o[`name_${lang}`] === object2 && distVal(o) != null);
    if (idx2 >= 0) obj2 = lib[idx2];
  }

  // Формування фінального об’єкта
  return {
    object1: {
      libIndex: idx1,
      name: obj1[`name_${lang}`],
      category: obj1[`category_${lang}`],
      diameterReal: diamVal(obj1),     // реальний ДІАМЕТР О1
      unit: diamUnit(obj1),            // його одиниця
      diameterScaled: input1,          // заданий КОРИСТУВАЧЕМ діаметр кола на мапі
      description: obj1[`description_${lang}`] || ''
    },
    object2: obj2 ? {
      libIndex: idx2,
      name: obj2.user ? obj2.name : obj2[`name_${lang}`],
      category: obj2.user ? obj2.category : obj2[`category_${lang}`],
      distanceReal: distVal(obj2),     // реальна ВІДСТАНЬ ДО ЗЕМЛІ
      unit: distUnit(obj2),
      description: obj2.user ? (obj2.description || '') : (obj2[`description_${lang}`] || '')
    } : null
  };
}
