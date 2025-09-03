// full/js/blocks/geo_area.js
'use strict';

/**
 * Режим «Географія → Площа» (UI).
 * - чекає завантаження geo-бібліотеки;
 * - будує селекти категорій і об’єктів (О1/О2);
 * - слухає reset / user-objects-* / languageChanged|lang-changed;
 * - не рахує нічого і не лізе в інші режими.
 */

import { t, getCurrentLang } from '../i18n.js';
import { loadGeoLibrary, getGeoLibrary } from '../data/geo_lib.js';
import { getStore } from '../userObjects/api.js';
import { attachO1QuickSuggest } from '../utils/o1QuickSuggest.js';

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

// ключ категорії (узгоджений з адаптером)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}
// є валідне поле area?
function hasArea(rec) {
  const v = Number(rec?.area?.value);
  return Number.isFinite(v) && v > 0;
}

// Канонічний вибір лейбла категорії без словників:
// точна мова → en → ua → es → базове поле → key
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

function rebuildCategorySelectsGeoArea(scope) {
  const lib  = getGeoLibrary() || [];
  const src  = lib.filter(hasArea); // ❗ лише записи з area
  const lang = getCurrentLang?.() || 'ua';
  const sel1 = scope.querySelector('#geoAreaCategoryObject1') || scope.querySelector('.object1-group .category-select');
  const sel2 = scope.querySelector('#geoAreaCategoryObject2') || scope.querySelector('.object2-group .category-select');

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

    // placeholder
    const ph = document.createElement('option');
    ph.value = '';
    ph.disabled = true;
    ph.selected = true;
    ph.hidden = true;
    ph.textContent = t('panel_placeholder_category');
    sel.appendChild(ph);

    // опції категорій з відфільтрованого набору
    [...keys].sort().forEach(k => {
      const label = getCategoryLabelByKey(src, k, lang);
      addOption(sel, k, label);
    });

    if (keep && [...keys].includes(keep)) sel.value = keep;
  });
}


function rebuildObjectsSelectGeoArea(scope, groupSelector, catSelector, objSelector) {
  const lib  = getGeoLibrary() || [];
  const src  = lib.filter(hasArea); // ❗ лише записи з area
  const lang = getCurrentLang?.() || 'ua';

  const group  = scope.querySelector(groupSelector);
  const catSel = scope.querySelector(catSelector);
  const objSel = scope.querySelector(objSelector);
  if (!group || !objSel) return;

  const catKey = low(catSel?.value || '');

  // офіційні об’єкти цієї категорії (з фільтром area)
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
function resetGeoAreaForm(scope) {
  // розблокувати О1 (на випадок якщо десь блокувався)
  scope.querySelector('.object1-group')?.classList.remove('is-locked');
  scope.querySelectorAll('.object1-group select, .object1-group input').forEach(el => {
    el.disabled = false;
    el.classList.remove('is-invalid');
  });

  // інпут діаметра + плейсхолдер
  const base = scope.querySelector('#geoAreaBaselineDiameter') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) {
    base.placeholder = t('panel_placeholder_input_diameter');
    base.value = '';
  }

  // перебудувати селекти
  rebuildCategorySelectsGeoArea(scope);
  rebuildObjectsSelectGeoArea(scope, '.object1-group', '#geoAreaCategoryObject1', '#geoAreaObject1');
  rebuildObjectsSelectGeoArea(scope, '.object2-group', '#geoAreaCategoryObject2', '#geoAreaObject2');
}

// ─────────────────────────────────────────────────────────────
// Публічний ініціалізатор

export async function initGeoAreaBlock() {
  await loadGeoLibrary();

  const scope = document.getElementById('geo_area');
  if (!scope) return;

  // стартове заповнення
  rebuildCategorySelectsGeoArea(scope);
  rebuildObjectsSelectGeoArea(scope, '.object1-group', '#geoAreaCategoryObject1', '#geoAreaObject1');
  rebuildObjectsSelectGeoArea(scope, '.object2-group', '#geoAreaCategoryObject2', '#geoAreaObject2');

  // плейсхолдер для інпута діаметра
  const base = scope.querySelector('#geoAreaBaselineDiameter') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) base.placeholder = t('panel_placeholder_input_diameter');
  if (base) attachO1QuickSuggest({ inputEl: base });

  // зміна категорій → оновити відповідний список об’єктів
  scope.querySelector('#geoAreaCategoryObject1')?.addEventListener('change', () => {
    rebuildObjectsSelectGeoArea(scope, '.object1-group', '#geoAreaCategoryObject1', '#geoAreaObject1');
  });
  scope.querySelector('#geoAreaCategoryObject2')?.addEventListener('change', () => {
    rebuildObjectsSelectGeoArea(scope, '.object2-group', '#geoAreaCategoryObject2', '#geoAreaObject2');
  });

  // події юзерських об'єктів → повна перебудова
  const rebuildAll = () => {
    rebuildCategorySelectsGeoArea(scope);
    rebuildObjectsSelectGeoArea(scope, '.object1-group', '#geoAreaCategoryObject1', '#geoAreaObject1');
    rebuildObjectsSelectGeoArea(scope, '.object2-group', '#geoAreaCategoryObject2', '#geoAreaObject2');
  };
  document.addEventListener('user-objects-added', rebuildAll);
  document.addEventListener('user-objects-changed', rebuildAll);
  document.addEventListener('user-objects-removed', rebuildAll);

  // Зміна мови під час сесії: слухаємо обидві події
  const onLangChange = () => rebuildAll();
  document.addEventListener('languageChanged', onLangChange);
  window.addEventListener('languageChanged', onLangChange);
  document.addEventListener('lang-changed', onLangChange);
  window.addEventListener('lang-changed', onLangChange);

  // системний Reset → локально очистити форму/стан режиму
  document.addEventListener('reset', () => resetGeoAreaForm(scope));

  console.log('[mode:geo:area] init OK');
}

// (опційно для тестів)
export { rebuildCategorySelectsGeoArea, rebuildObjectsSelectGeoArea, resetGeoAreaForm };
