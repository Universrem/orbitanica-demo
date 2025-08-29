// full/js/blocks/geo_objects.js
'use strict';

/**
 * Режим «Географія → Об’єкти (довжина/висота)» (UI).
 * - чекає завантаження geo-бібліотеки;
 * - будує селекти категорій і об’єктів (О1/О2) ЛИШЕ з записів, що мають length або height;
 * - слухає reset / user-objects-* / languageChanged|lang-changed;
 * - не рахує нічого і не лізе в інші режими.
 */

import { t, getCurrentLang } from '../i18n.js';
import { loadGeoLibrary, getGeoLibrary } from '../data/geo_lib.js';
import { getStore } from '../userObjects/api.js';

// ─────────────────────────────────────────────────────────────
// Утіліти

const norm = s => String(s ?? '').trim();
const low  = s => norm(s).toLowerCase();

function pickLang(rec, base, lang) {
  if (!rec) return '';
  const a = rec[`${base}_${lang}`];
  const b = rec[`${base}_en`];
  const c = rec[`${base}_ua`];
  const d = rec[`${base}_es`];
  const e = rec[base];
  return norm(a || b || c || d || e || '');
}

// ключ категорії (узгоджений з адаптерами)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

// валідне поле length/height?
function hasLinear(rec) {
  const lv = Number(rec?.length?.value);
  const hv = Number(rec?.height?.value);
  return (Number.isFinite(lv) && lv > 0) || (Number.isFinite(hv) && hv > 0);
}

// підпис категорії за key у вибраній мові
function getCategoryLabelByKey(lib, key, lang) {
  const k = String(key || '').trim().toLowerCase();
  const rows = Array.isArray(lib) ? lib.filter(r => getCatKey(r) === k) : [];
  if (rows.length === 0) return norm(key);

  const prefs = [`category_${lang}`, 'category_en', 'category_ua', 'category_es', 'category'];
  for (const field of prefs) {
    for (const r of rows) {
      const v = r && r[field] ? String(r[field]).trim() : '';
      if (v) return v;
    }
  }
  return norm(key);
}

function clearSelect(sel) {
  if (!sel) return;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
}

function addOption(sel, value, label) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  sel.appendChild(opt);
}

// ─────────────────────────────────────────────────────────────
// Побудова списків

function rebuildCategorySelectsGeoObjects(scope) {
  const lib  = getGeoLibrary() || [];
  const src  = lib.filter(hasLinear); // лише записи з length/height
  const lang = getCurrentLang?.() || 'ua';
  const sel1 = scope.querySelector('#geoObjCategoryObject1') || scope.querySelector('.object1-group .category-select');
  const sel2 = scope.querySelector('#geoObjCategoryObject2') || scope.querySelector('.object2-group .category-select');

  const selects = [sel1, sel2].filter(Boolean);
  if (!selects.length) return;

  const keys = new Set();
  src.forEach(rec => {
    const k = getCatKey(rec);
    if (k) keys.add(k);
  });

  selects.forEach(sel => {
    const keep = (sel && String(sel.value || '') || '').trim();
    clearSelect(sel);

    const ph = document.createElement('option');
    ph.value = '';
    ph.disabled = true;
    ph.selected = true;
    ph.hidden = true;
    ph.textContent = t('panel_placeholder_category');
    sel.appendChild(ph);

    [...keys].sort().forEach(k => {
      const label = getCategoryLabelByKey(src, k, lang);
      addOption(sel, k, label);
    });

    if (keep && [...keys].includes(keep)) sel.value = keep;
  });
}

function rebuildObjectsSelectGeoObjects(scope, groupSelector, catSelector, objSelector) {
  const lib  = getGeoLibrary() || [];
  const src  = lib.filter(hasLinear);
  const lang = getCurrentLang?.() || 'ua';

  const group  = scope.querySelector(groupSelector);
  const catSel = scope.querySelector(catSelector);
  const objSel = scope.querySelector(objSelector);
  if (!group || !objSel) return;

  const catKey = low(catSel?.value || '');

  // офіційні об’єкти цієї категорії
  const official = catKey ? src.filter(rec => getCatKey(rec) === catKey) : [];

  // юзерські — зіставляємо за локалізованою назвою категорії
  const store = getStore();
  let userItems = [];
  if (catKey && typeof store?.list === 'function') {
    const catLabel = getCategoryLabelByKey(src, catKey, lang);
    const all = store.list('geo') || [];
    userItems = all.filter(o => low(o?.category || o?.category_i18n?.[o?.originalLang]) === low(catLabel));
  }

  const keep = (objSel && String(objSel.value || '') || '').trim();
  clearSelect(objSel);

  // placeholder об’єкта
  const ph = document.createElement('option');
  ph.value = '';
  ph.disabled = true;
  ph.selected = true;
  ph.hidden = true;
  const isO1 = groupSelector.includes('object1') || objSelector.toLowerCase().includes('object1');
  ph.textContent = isO1 ? t('panel_placeholder_object1') : t('panel_placeholder_object2');
  objSel.appendChild(ph);

  // офіційні
  official.forEach(rec => {
    const name = pickLang(rec, 'name', lang);
    if (name) addOption(objSel, name, name);
  });

  // юзерські
  userItems.forEach(u => {
    const name = String(u?.name || u?.name_i18n?.[u?.originalLang] || '').trim();
    if (!name) return;
    addOption(objSel, name, name + ' ' + (t?.('ui.user_mark') || '(user)'));
  });

  if (keep) objSel.value = keep;
}

// локальне очищення форми при reset
function resetGeoObjectsForm(scope) {
  scope.querySelector('.object1-group')?.classList.remove('is-locked');
  scope.querySelectorAll('.object1-group select, .object1-group input').forEach(el => {
    el.disabled = false;
    el.classList.remove('is-invalid');
  });

  const base = scope.querySelector('#geoObjBaselineDiameter') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) {
    base.placeholder = t('panel_placeholder_input_diameter');
    base.value = '';
  }

  rebuildCategorySelectsGeoObjects(scope);
  rebuildObjectsSelectGeoObjects(scope, '.object1-group', '#geoObjCategoryObject1', '#geoObjObject1');
  rebuildObjectsSelectGeoObjects(scope, '.object2-group', '#geoObjCategoryObject2', '#geoObjObject2');
}

// ─────────────────────────────────────────────────────────────
// Публічний ініціалізатор

export async function initGeoObjectsBlock() {
  await loadGeoLibrary();

  const scope = document.getElementById('geo_objects');
  if (!scope) return;

  rebuildCategorySelectsGeoObjects(scope);
  rebuildObjectsSelectGeoObjects(scope, '.object1-group', '#geoObjCategoryObject1', '#geoObjObject1');
  rebuildObjectsSelectGeoObjects(scope, '.object2-group', '#geoObjCategoryObject2', '#geoObjObject2');

  const base = scope.querySelector('#geoObjBaselineDiameter') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) base.placeholder = t('panel_placeholder_input_diameter');

  scope.querySelector('#geoObjCategoryObject1')?.addEventListener('change', () => {
    rebuildObjectsSelectGeoObjects(scope, '.object1-group', '#geoObjCategoryObject1', '#geoObjObject1');
  });
  scope.querySelector('#geoObjCategoryObject2')?.addEventListener('change', () => {
    rebuildObjectsSelectGeoObjects(scope, '.object2-group', '#geoObjCategoryObject2', '#geoObjObject2');
  });

  const rebuildAll = () => {
    rebuildCategorySelectsGeoObjects(scope);
    rebuildObjectsSelectGeoObjects(scope, '.object1-group', '#geoObjCategoryObject1', '#geoObjObject1');
    rebuildObjectsSelectGeoObjects(scope, '.object2-group', '#geoObjCategoryObject2', '#geoObjObject2');
  };
  document.addEventListener('user-objects-added', rebuildAll);
  document.addEventListener('user-objects-changed', rebuildAll);
  document.addEventListener('user-objects-removed', rebuildAll);

  const onLangChange = () => rebuildAll();
  document.addEventListener('languageChanged', onLangChange);
  window.addEventListener('languageChanged', onLangChange);
  document.addEventListener('lang-changed', onLangChange);
  window.addEventListener('lang-changed', onLangChange);

  document.addEventListener('reset', () => resetGeoObjectsForm(scope));

  console.log('[mode:geo:objects] init OK');
}

export { rebuildCategorySelectsGeoObjects, rebuildObjectsSelectGeoObjects, resetGeoObjectsForm };
