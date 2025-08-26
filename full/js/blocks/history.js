// full/js/blocks/univers_history.js
'use strict';

import { getCurrentLang, t } from '../i18n.js';
import { getStore } from '../userObjects/api.js';
import { loadHistoryLibrary, getHistoryLibrary } from '../data/data_history.js';

export async function initHistoryBlock() {

  await loadHistoryLibrary();
  updateCategories();
  rebuildObjectsForSelectedCategories();

  // слухачі змін категорій
  ['histCategoryObject1', 'histCategoryObject2'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && !sel.__histBound) {
      sel.addEventListener('change', rebuildObjectsForSelectedCategories);
      sel.__histBound = true;
    }
  });
}

function updateCategories() {
  const lang = getCurrentLang();
  const lib = getHistoryLibrary() || [];
  const cats = new Set();

  // з офіційної бібліотеки
  lib.forEach(o => {
    const c = o?.[`category_${lang}`];
    const hasTime = Number.isFinite(readYear(o, 'time_start')) || Number.isFinite(readYear(o, 'time_end'));
    if (c && hasTime) cats.add(c);
  });

  // з користувацьких
  try {
    const store = getStore();
    const user = store?.list?.('history') || [];
    user.forEach(o => {
      const c = o?.category_i18n?.[lang] || o?.category;
      const yS = o?.attrs?.time_start, yE = o?.attrs?.time_end;
      const hasTime = Number.isFinite(yS) || Number.isFinite(yE);
      if (c && hasTime) cats.add(c);
    });
  } catch {}

  const list = Array.from(cats).sort((a, b) => a.localeCompare(b, 'uk'));

  ['histCategoryObject1', 'histCategoryObject2'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';

    const ph = document.createElement('option');
    ph.value = ''; ph.disabled = true; ph.selected = true; ph.hidden = true;
    ph.textContent = t('panel_placeholder_category');
    sel.appendChild(ph);

    list.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });

    if (prev && list.includes(prev)) sel.value = prev;
  });
}

function repopulateObjectsSelect(selectId, category, placeholderKey) {
  const lang = getCurrentLang();
  const lib = getHistoryLibrary() || [];
  const store = getStore?.();

  const sel = document.getElementById(selectId);
  if (!sel) return;

  const prev = sel.value;
  sel.innerHTML = '';

  const ph = document.createElement('option');
  ph.value = ''; ph.disabled = true; ph.selected = true; ph.hidden = true;
  ph.textContent = t(placeholderKey);
  sel.appendChild(ph);

  const out = [];

  // офіційні
  lib.forEach(o => {
    const ok = o && o[`category_${lang}`] === category &&
      (Number.isFinite(readYear(o, 'time_start')) || Number.isFinite(readYear(o, 'time_end')));
    if (!ok) return;
    out.push({ name: o[`name_${lang}`], source: 'lib' });
  });

  // користувацькі
  try {
    const user = store?.list?.('history') || [];
    user.forEach(o => {
      const ok = o && (o.category === category || o.category_i18n?.[lang] === category) &&
        (Number.isFinite(o?.attrs?.time_start) || Number.isFinite(o?.attrs?.time_end));
      if (!ok) return;
      out.push({ name: o.name || o.name_i18n?.[lang], source: 'user' });
    });
  } catch {}

  out.sort((a, b) => a.name.localeCompare(b.name, 'uk'));

  out.forEach(it => {
    const opt = document.createElement('option');
    opt.value = it.name;
    opt.textContent = it.source === 'user' ? `${it.name} •` : it.name;
    sel.appendChild(opt);
  });

  if (prev) {
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === prev) { sel.value = prev; break; }
    }
  }
}

function rebuildForSlot(slot) {
  const catId = slot === 'object1' ? 'histCategoryObject1' : 'histCategoryObject2';
  const objId = slot === 'object1' ? 'histObject1'         : 'histObject2';
  const cat = document.getElementById(catId)?.value || '';
  repopulateObjectsSelect(objId, cat, slot === 'object1' ? 'panel_placeholder_object1' : 'panel_placeholder_object2');
}
function rebuildObjectsForSelectedCategories() {
  rebuildForSlot('object1');
  rebuildForSlot('object2');
}

// локальний хелпер
function readYear(obj, key) {
  const v = obj?.[key];
  if (typeof v === 'number') return v;
  if (v && typeof v.value === 'number') return v.value;
  return null;
}
