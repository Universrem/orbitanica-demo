// full/js/data/data_luminosity.js
'use strict';

import { getCurrentLang } from '../i18n.js';
import { getStore } from '../userObjects/api.js';
import { getUniverseLibrary } from './universe.js';

// читання світності з різних форматів
function lumiVal(o) {
  if (!o) return null;
  if (typeof o.luminosity === 'number') return o.luminosity;
  if (o.luminosity && typeof o.luminosity.value === 'number') return o.luminosity.value;
  return null;
}
function lumiUnit(o) {
  if (!o) return null;
  if (typeof o.luminosity === 'number') return 'L☉';
  if (o.luminosity && typeof o.luminosity.unit === 'string') return o.luminosity.unit || 'L☉';
  return 'L☉';
}
function userDesc(o, lang) {
  if (!o) return '';
  return (typeof o.description === 'string' && o.description) ? o.description : (o[`description_${lang}`] || '');
}

export function getLuminosityData() {
  const lang = getCurrentLang();
  const lib = getUniverseLibrary() || [];
  const store = getStore?.();

  const cat1 = document.getElementById('lumiCategoryObject1')?.value || '';
  const obj1 = document.getElementById('lumiObject1')?.value || '';
  const input1 = Number.parseFloat(document.getElementById('lumiCircleObject1')?.value || '');

  const cat2 = document.getElementById('lumiCategoryObject2')?.value || '';
  const obj2 = document.getElementById('lumiObject2')?.value || '';

  // ---- Об'єкт 1
  let o1 = null, idx1 = -1;
  try {
    const userList = (store && typeof store.listByCategory === 'function') ? (store.listByCategory(cat1) || []) : [];
    o1 = userList.find(o => (o.name === obj1 || o[`name_${lang}`] === obj1) && lumiVal(o) != null);
  } catch {}
  if (!o1 && obj1) {
    idx1 = lib.findIndex(o => o[`name_${lang}`] === obj1 && lumiVal(o) != null);
    if (idx1 >= 0) o1 = lib[idx1];
  }
  if (!o1) return null;

  // ---- Об'єкт 2 (може бути відсутній до натискання Start)
  let o2 = null, idx2 = -1;
  try {
    const userList2 = (store && typeof store.listByCategory === 'function') ? (store.listByCategory(cat2) || []) : [];
    o2 = userList2.find(o => (o.name === obj2 || o[`name_${lang}`] === obj2) && lumiVal(o) != null);
  } catch {}
  if (!o2 && obj2) {
    idx2 = lib.findIndex(o => o[`name_${lang}`] === obj2 && lumiVal(o) != null);
    if (idx2 >= 0) o2 = lib[idx2];
  }

  return {
    object1: {
      libIndex: idx1,
      name: o1.user ? o1.name : (o1[`name_${lang}`] || ''),
      category: o1.user ? o1.category : (o1[`category_${lang}`] || ''),
      luminosityReal: lumiVal(o1),
      unit: lumiUnit(o1),
      diameterScaled: input1, // діаметр кола на мапі, який ввів користувач
      description: o1.user ? userDesc(o1, lang) : (o1[`description_${lang}`] || '')
    },
    object2: o2 ? {
      libIndex: idx2,
      name: o2.user ? o2.name : (o2[`name_${lang}`] || ''),
      category: o2.user ? o2.category : (o2[`category_${lang}`] || ''),
      luminosityReal: lumiVal(o2),
      unit: lumiUnit(o2),
      description: o2.user ? userDesc(o2, lang) : (o2[`description_${lang}`] || '')
    } : null
  };
}
