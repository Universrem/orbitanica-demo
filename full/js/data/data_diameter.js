// full/js/data/data_diameter.js
'use strict';

import { getCurrentLang } from '../i18n.js';
import { getStore } from '../userObjects/api.js';

let universeLibrary = [];

export function getUniverseLibrary() {
  return universeLibrary;
}

export async function loadUniverseLibrary() {
  try {
    const response = await fetch('/full/data/univers.json');
    universeLibrary = await response.json();
  } catch (err) {
    console.error('❌ Не вдалося завантажити univers.json', err);
    universeLibrary = [];
  }
}

// ── хелпери читання діаметра з різних форматів ─────────────────────────────

function diamVal(o) {
  if (!o) return null;
  if (typeof o.diameter === 'number') return o.diameter; // старий формат
  if (o.diameter && typeof o.diameter.value === 'number') return o.diameter.value; // новий формат
  return null;
}

function diamUnit(o) {
  if (!o) return null;
  if (o.diameter && typeof o.diameter.unit === 'string') return o.diameter.unit; // новий формат
  if (o.unit) return o.unit;                 // старі можливі поля
  if (o.diameter_unit) return o.diameter_unit;
  if (o.diameterUnit)  return o.diameterUnit;
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

/** Повертає дані для розрахунку масштабування діаметра */
export function getDiameterData() {
  const lang = getCurrentLang();

  const category1 = document.getElementById('diamCategoryObject1')?.value;
  const object1   = document.getElementById('diamObject1')?.value;
  const input1    = parseFloat(document.getElementById('diamCircleObject1')?.value);

  const category2 = document.getElementById('diamCategoryObject2')?.value;
  const object2   = document.getElementById('diamObject2')?.value;

  if (!category1 || !object1 || isNaN(input1)) {
    return null; // Об'єкт 1 обов'язковий; Об'єкт 2 — опціональний
  }


  // 1) спочатку шукаємо серед КОРИСТУВАЦЬКИХ (пріоритет при однакових назвах)
  const store = getStore();

  let idx1 = -1, idx2 = -1;
  let obj1 = null, obj2 = null;

  const u1 = store.getByName('diameter', object1, category1);
  if (u1) {
    obj1 = {
      user: true,
      name:
        u1.name ||
        u1.name_i18n?.[lang] ||
        u1.name_i18n?.[u1.originalLang] || '',
      category:
        u1.category ||
        u1.category_i18n?.[lang] ||
        u1.category_i18n?.[u1.originalLang] || '',
      diameter: {
        value: u1.attrs?.diameter?.value,
        unit:  u1.attrs?.diameter?.unit
      },
      description: userDesc(u1, lang)
    };
  }

  const u2 = store.getByName('diameter', object2, category2);
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
      diameter: {
        value: u2.attrs?.diameter?.value,
        unit:  u2.attrs?.diameter?.unit
      },
      description: userDesc(u2, lang)
    };
  }

  // 2) якщо юзер-варіант не знайдено — беремо з офіційної бібліотеки
  if (!obj1) {
    idx1 = universeLibrary.findIndex(o => o[`name_${lang}`] === object1);
    if (idx1 >= 0) obj1 = universeLibrary[idx1];
  }
  if (!obj2) {
    idx2 = universeLibrary.findIndex(o => o[`name_${lang}`] === object2);
    if (idx2 >= 0) obj2 = universeLibrary[idx2];
  }

  // 3) якщо взяли офіційний, але в нього немає значення діаметра — падаємо на юзерський (якщо є)
  if (obj1 && !obj1.user && diamVal(obj1) == null && u1) {
    obj1 = {
      user: true,
      name:
        u1.name ||
        u1.name_i18n?.[lang] ||
        u1.name_i18n?.[u1.originalLang] || '',
      category:
        u1.category ||
        u1.category_i18n?.[lang] ||
        u1.category_i18n?.[u1.originalLang] || '',
      diameter: {
        value: u1.attrs?.diameter?.value,
        unit:  u1.attrs?.diameter?.unit
      },
      description: userDesc(u1, lang)
    };
    idx1 = -1;
  }
  if (obj2 && !obj2.user && diamVal(obj2) == null && u2) {
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
      diameter: {
        value: u2.attrs?.diameter?.value,
        unit:  u2.attrs?.diameter?.unit
      },
      description: userDesc(u2, lang)
    };
    idx2 = -1;
  }

  if (!obj1) return null; // без О2 допускаємо розрахунок


  // 4) фінальний об’єкт для інфопанелі й розрахунку
  return {
    object1: {
      libIndex: idx1,
      name: obj1.user ? obj1.name : obj1[`name_${lang}`],
      category: obj1.user ? obj1.category : obj1[`category_${lang}`],
      diameterReal: diamVal(obj1),
      unit: diamUnit(obj1),
      diameterScaled: input1,
      description: obj1.user ? (obj1.description || '') : (obj1[`description_${lang}`] || '')
    },
    object2: obj2 ? {
      libIndex: idx2,
      name: obj2.user ? obj2.name : obj2[`name_${lang}`],
      category: obj2.user ? obj2.category : obj2[`category_${lang}`],
      diameterReal: diamVal(obj2),
      unit: diamUnit(obj2),
      description: obj2.user ? (obj2.description || '') : (obj2[`description_${lang}`] || '')
    } : null
  };
}



