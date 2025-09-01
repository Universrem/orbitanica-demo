// full/js/blocks/univers_diameter.js
'use strict';

/**
 * Блок режиму «Діаметри» (UI) за еталоном «Гроші».
 * - чекає завантаження univers-бібліотеки;
 * - будує селекти категорій і об’єктів (О1/О2);
 * - слухає reset / user-objects-* / languageChanged|lang-changed;
 * - не рахує нічого і не лізе в інші режими.
 */

import { t, getCurrentLang } from '../i18n.js';
import { loadUniversLibrary, getUniversLibrary } from '../data/univers_lib.js';
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

// ключ категорії (узгоджений з адаптерами)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
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

function rebuildCategorySelects(scope) {
  const lib  = getUniversLibrary() || [];
  const lang = getCurrentLang?.() || 'ua';
  const sel1 = scope.querySelector('#diamCategoryObject1') || scope.querySelector('.object1-group .category-select');
  const sel2 = scope.querySelector('#diamCategoryObject2') || scope.querySelector('.object2-group .category-select');

  const selects = [sel1, sel2].filter(Boolean);
  if (!selects.length) return;

  const keys = new Set();
  lib.forEach(rec => {
    const k = getCatKey(rec);
    if (k) keys.add(k);
  });

  selects.forEach(sel => {
    const keep = norm(sel.value);
    clearSelect(sel);

    // placeholder (disabled + selected + hidden)
    const ph = document.createElement('option');
    ph.value = '';
    ph.disabled = true;
    ph.selected = true;
    ph.hidden = true;
    ph.textContent = t('panel_placeholder_category');
    sel.appendChild(ph);

    // опції категорій
    [...keys].sort().forEach(k => {
      const label = getCategoryLabelByKey(lib, k, lang);
      addOption(sel, k, label);
    });

    // відновити вибір
    if (keep && [...keys].includes(keep)) sel.value = keep;
  });
}

function rebuildObjectsSelect(scope, groupSelector, catSelector, objSelector) {
  const lib  = getUniversLibrary() || [];
  const lang = getCurrentLang?.() || 'ua';

  const group  = scope.querySelector(groupSelector);
  const catSel = scope.querySelector(catSelector);
  const objSel = scope.querySelector(objSelector);
  if (!group || !objSel) return;

  const catKey = low(catSel?.value || '');

  // офіційні об’єкти цієї категорії
  const official = catKey ? lib.filter(rec => getCatKey(rec) === catKey) : [];

  // юзерські (за текстовою категорією відповідною до поточної мови)
  const store = getStore();
  let userItems = [];
  if (catKey && typeof store?.list === 'function') {
    const catLabel = getCategoryLabelByKey(lib, catKey, lang);
    const all = store.list('diameter') || [];
    userItems = all.filter(o => low(o?.category || o?.category_i18n?.[o?.originalLang]) === low(catLabel));
  }

  const keep = norm(objSel.value);
  clearSelect(objSel);

  // placeholder об’єкта (для О1/О2 різні підписи)
  const ph = document.createElement('option');
  ph.value = '';
  ph.disabled = true;
  ph.selected = true;
  ph.hidden = true;
  const isO1 = groupSelector.includes('object1') || objSelector.toLowerCase().includes('object1');
  ph.textContent = isO1
    ? t('panel_placeholder_object1')
    : t('panel_placeholder_object2');
  objSel.appendChild(ph);

  // офіційні
  official.forEach(rec => {
    const name = pickLang(rec, 'name', lang);
    if (name) addOption(objSel, name, name);
  });

  // юзерські
  userItems.forEach(u => {
    const name = norm(u?.name || u?.name_i18n?.[u?.originalLang]);
    if (!name) return;
    addOption(objSel, name, name + ' ' + (t?.('ui.user_mark') || '(user)'));
  });

  if (keep) objSel.value = keep;
}

// локальне очищення форми при reset
function resetDiameterForm(scope) {
  // розблокувати О1 (на випадок якщо десь блокувався)
  scope.querySelector('.object1-group')?.classList.remove('is-locked');
  scope.querySelectorAll('.object1-group select, .object1-group input').forEach(el => {
    el.disabled = false;
    el.classList.remove('is-invalid');
  });

  // інпут базового діаметра О1 + плейсхолдер
  const base = scope.querySelector('#diamCircleObject1') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) {
    base.placeholder = t('panel_placeholder_input_diameter');
    base.value = '';
  }

  // перебудувати селекти
  rebuildCategorySelects(scope);
  rebuildObjectsSelect(scope, '.object1-group', '#diamCategoryObject1', '#diamObject1');
  rebuildObjectsSelect(scope, '.object2-group', '#diamCategoryObject2', '#diamObject2');
}

// ─────────────────────────────────────────────────────────────
// Публічний ініціалізатор

export async function initUniversDiameterBlock() {
  await loadUniversLibrary();

  const scope = document.getElementById('univers_diameter');
  if (!scope) return;

  // стартове заповнення
  rebuildCategorySelects(scope);
  rebuildObjectsSelect(scope, '.object1-group', '#diamCategoryObject1', '#diamObject1');
  rebuildObjectsSelect(scope, '.object2-group', '#diamCategoryObject2', '#diamObject2');

  // плейсхолдер для інпута базового діаметра О1
  const base = scope.querySelector('#diamCircleObject1') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) base.placeholder = t('panel_placeholder_input_diameter');
  if (base) attachO1QuickSuggest({ inputEl: base });

  // зміна категорій → оновити відповідний список об’єктів
  scope.querySelector('#diamCategoryObject1')?.addEventListener('change', () => {
    rebuildObjectsSelect(scope, '.object1-group', '#diamCategoryObject1', '#diamObject1');
  });
  scope.querySelector('#diamCategoryObject2')?.addEventListener('change', () => {
    rebuildObjectsSelect(scope, '.object2-group', '#diamCategoryObject2', '#diamObject2');
  });

  // події юзерських об'єктів → повна перебудова
  const rebuildAll = () => {
    rebuildCategorySelects(scope);
    rebuildObjectsSelect(scope, '.object1-group', '#diamCategoryObject1', '#diamObject1');
    rebuildObjectsSelect(scope, '.object2-group', '#diamCategoryObject2', '#diamObject2');
  };
  document.addEventListener('user-objects-added', rebuildAll);
  document.addEventListener('user-objects-changed', rebuildAll);
  document.addEventListener('user-objects-removed', rebuildAll);

  // ЗМІНА МОВИ ПІД ЧАС СЕСІЇ (повна сумісність)
  const onLangChange = () => rebuildAll();
  document.addEventListener('languageChanged', onLangChange);
  window.addEventListener('languageChanged', onLangChange);
  document.addEventListener('lang-changed', onLangChange);
  window.addEventListener('lang-changed', onLangChange);

  // системний Reset → локально очистити форму/стан режиму
  document.addEventListener('reset', () => resetDiameterForm(scope));

  console.log('[mode:univers_diameter] init OK');
}

// (опційно для тестів)
export { rebuildCategorySelects, rebuildObjectsSelect, resetDiameterForm };
