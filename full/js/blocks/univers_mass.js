// full/js/blocks/univers_mass.js
'use strict';

import { getCurrentLang, t } from '../i18n.js';
import { getStore } from '../userObjects/api.js';
import { loadUniverseLibrary, getUniverseLibrary } from '../data/universe.js';

// Пріоритетні об’єкти для слоту О1 (щоб були зверху списку)
const O1_TOP = {
  ua: ['Земля'],
  en: ['Earth'],
  es: ['Tierra']
};

export async function initUniversMassBlock() {
  await loadUniverseLibrary();
  updateCategories();
  rebuildObjectsForSelectedCategories();

  // слухачі змін категорій
  ['massCategoryObject1', 'massCategoryObject2'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && !sel.__massBound) {
      sel.addEventListener('change', rebuildObjectsForSelectedCategories);
      sel.__massBound = true;
    }
  });
}

function updateCategories() {
  const lang = getCurrentLang();
  const lib = getUniverseLibrary() || [];
  const store = getStore?.();

  const cats = new Set();

  // з бібліотеки
  lib.forEach(o => {
    const has = o && (typeof o.mass === 'number' || typeof o.mass?.value === 'number');
    if (!has) return;
    const c = o[`category_${lang}`];
    if (c) cats.add(c);
  });

  // з користувацьких
  try {
    const userAll = store?.listAll?.() || [];
    userAll.forEach(o => {
      const has = o && (typeof o.mass === 'number' || typeof o.mass?.value === 'number');
      if (!has) return;
      if (o.category) cats.add(o.category);
      else if (o[`category_${lang}`]) cats.add(o[`category_${lang}`]);
    });
  } catch {}

  const list = Array.from(cats).sort((a, b) => a.localeCompare(b, 'uk'));

  ['massCategoryObject1', 'massCategoryObject2'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';

    const ph = document.createElement('option');
    ph.value = '';
    ph.disabled = true;
    ph.selected = true;
    ph.hidden = true;
    ph.textContent = t('panel_placeholder_category');
    sel.appendChild(ph);

    list.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });

    if (prev && list.includes(prev)) sel.value = prev;
  });
}

function repopulateObjectsSelect(selectId, category, placeholderKey, slot) {
  const lang = getCurrentLang();
  const lib = getUniverseLibrary() || [];
  const store = getStore?.();

  const sel = document.getElementById(selectId);
  if (!sel) return;

  const prev = sel.value;
  sel.innerHTML = '';

  const ph = document.createElement('option');
  ph.value = '';
  ph.disabled = true;
  ph.selected = true;
  ph.hidden = true;
  ph.textContent = t(placeholderKey);
  sel.appendChild(ph);

  const out = [];

  // офіційні
  lib.forEach(o => {
    const ok =
      o &&
      o[`category_${lang}`] === category &&
      (typeof o.mass === 'number' || typeof o.mass?.value === 'number');
    if (!ok) return;
    out.push({ name: o[`name_${lang}`], source: 'lib' });
  });

  // користувацькі
  try {
    const user = store?.listByCategory?.(category) || [];
    user.forEach(o => {
      const ok = o && (typeof o.mass === 'number' || typeof o.mass?.value === 'number');
      if (!ok) return;
      out.push({ name: o.name || o[`name_${lang}`], source: 'user' });
    });
  } catch {}

  // Пріоритет для О1 (наприклад, Земля)
  if (slot === 'object1') {
    const top = O1_TOP[lang] || [];
    out.sort((a, b) => {
      const ai = top.includes(a.name) ? 0 : 1;
      const bi = top.includes(b.name) ? 0 : 1;
      return ai - bi || a.name.localeCompare(b.name, 'uk');
    });
  } else {
    out.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  }

  out.forEach(it => {
    const opt = document.createElement('option');
    opt.value = it.name;
    opt.textContent = it.source === 'user' ? `${it.name} •` : it.name;
    sel.appendChild(opt);
  });

  if (prev) {
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === prev) {
        sel.value = prev;
        break;
      }
    }
  }
}

function rebuildForSlot(slot) {
  const catId = slot === 'object1' ? 'massCategoryObject1' : 'massCategoryObject2';
  const objId = slot === 'object1' ? 'massObject1' : 'massObject2';
  const cat = document.getElementById(catId)?.value || '';
  repopulateObjectsSelect(
    objId,
    cat,
    slot === 'object1' ? 'panel_placeholder_object1' : 'panel_placeholder_object2',
    slot
  );
}

function rebuildObjectsForSelectedCategories() {
  rebuildForSlot('object1');
  rebuildForSlot('object2');
}
