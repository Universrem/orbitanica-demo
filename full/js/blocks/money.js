// full/js/blocks/money.js
'use strict';

/**
 * Еталонний блок режиму «Гроші» (UI).
 * - чекає завантаження money-бібліотеки;
 * - будує селекти категорій і об’єктів (О1/О2);
 * - слухає reset / user-objects-* / lang-changed;
 * - не рахує нічого і не лізе в інші режими.
 */

import { t, getCurrentLang } from '../i18n.js';
import { loadMoneyLibrary, getMoneyLibrary } from '../data/money_lib.js';
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

// ❗ Канонічний вибір лейбла категорії без “костилів” і словників:
//   точна мова → en → ua → es → базове поле → key
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
  const lib  = getMoneyLibrary() || [];
  const lang = getCurrentLang?.() || 'ua';
  const sel1 = scope.querySelector('#moneyCategoryObject1') || scope.querySelector('.object1-group .category-select');
  const sel2 = scope.querySelector('#moneyCategoryObject2') || scope.querySelector('.object2-group .category-select');

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

    // placeholder (disabled + selected + hidden — як в інших режимах)
    const ph = document.createElement('option');
    ph.value = '';
    ph.disabled = true;
    ph.selected = true;
    ph.hidden = true;
    ph.textContent = t('panel_placeholder_category');
    sel.appendChild(ph);

    // опції категорій (відсортовані за ключем, підписані мовою lang із фолбеками)
    [...keys].sort().forEach(k => {
      const label = getCategoryLabelByKey(lib, k, lang);
      addOption(sel, k, label);
    });

    // відновити вибір
    if (keep && [...keys].includes(keep)) sel.value = keep;
  });
}

function rebuildObjectsSelect(scope, groupSelector, catSelector, objSelector) {
  const lib  = getMoneyLibrary() || [];
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
    const all = store.list('money') || [];
    userItems = all.filter(o => low(o?.category || o?.category_i18n?.[o?.originalLang]) === low(catLabel));
  }

  const keep = norm(objSel.value);
  clearSelect(objSel);

  // placeholder об’єкта: окремо для О1/О2 — як у всіх режимах
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
function resetMoneyForm(scope) {
  // розблокувати О1 (на випадок якщо десь блокувався)
  scope.querySelector('.object1-group')?.classList.remove('is-locked');
  scope.querySelectorAll('.object1-group select, .object1-group input').forEach(el => {
    el.disabled = false;
    el.classList.remove('is-invalid');
  });

  // інпут діаметра + плейсхолдер
  const base = scope.querySelector('#moneyBaselineDiameter') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) {
    base.placeholder = t('panel_placeholder_input_diameter');
    base.value = '';
  }

  // перебудувати селекти
  rebuildCategorySelects(scope);
  rebuildObjectsSelect(scope, '.object1-group', '#moneyCategoryObject1', '#moneyObject1');
  rebuildObjectsSelect(scope, '.object2-group', '#moneyCategoryObject2', '#moneyObject2');
}

// ─────────────────────────────────────────────────────────────
// Публічний ініціалізатор

export async function initMoneyBlock() {
  await loadMoneyLibrary();

  const scope = document.getElementById('money');
  if (!scope) return;

  // стартове заповнення
  rebuildCategorySelects(scope);
  rebuildObjectsSelect(scope, '.object1-group', '#moneyCategoryObject1', '#moneyObject1');
  rebuildObjectsSelect(scope, '.object2-group', '#moneyCategoryObject2', '#moneyObject2');

  // плейсхолдер для інпута діаметра
  const base = scope.querySelector('#moneyBaselineDiameter') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) base.placeholder = t('panel_placeholder_input_diameter');
  if (base) attachO1QuickSuggest({ inputEl: base });


  // зміна категорій → оновити відповідний список об’єктів
  scope.querySelector('#moneyCategoryObject1')?.addEventListener('change', () => {
    rebuildObjectsSelect(scope, '.object1-group', '#moneyCategoryObject1', '#moneyObject1');
  });
  scope.querySelector('#moneyCategoryObject2')?.addEventListener('change', () => {
    rebuildObjectsSelect(scope, '.object2-group', '#moneyCategoryObject2', '#moneyObject2');
  });

  // події юзерських об'єктів → повна перебудова
  const rebuildAll = () => {
    rebuildCategorySelects(scope);
    rebuildObjectsSelect(scope, '.object1-group', '#moneyCategoryObject1', '#moneyObject1');
    rebuildObjectsSelect(scope, '.object2-group', '#moneyCategoryObject2', '#moneyObject2');
  };
  document.addEventListener('user-objects-added', rebuildAll);
  document.addEventListener('user-objects-changed', rebuildAll);
  document.addEventListener('user-objects-removed', rebuildAll);

  // ЗМІНА МОВИ ПІД ЧАС СЕСІЇ:
  // інші режими слухають 'languageChanged'; раніше ми слухали лише 'lang-changed'.
  // Стаємо сумісними — слухаємо ОБИДВІ на document і window.
  const onLangChange = () => rebuildAll();
  document.addEventListener('languageChanged', onLangChange);
  window.addEventListener('languageChanged', onLangChange);
  document.addEventListener('lang-changed', onLangChange);
  window.addEventListener('lang-changed', onLangChange);

  // системний Reset → локально очистити форму/стан режиму
  document.addEventListener('reset', () => resetMoneyForm(scope));

  console.log('[mode:money] init OK');
}

// (опційно для тестів)
export { rebuildCategorySelects, rebuildObjectsSelect, resetMoneyForm };
