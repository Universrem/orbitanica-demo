// full/js/blocks/univers_distance.js
'use strict';

/**
 * Еталонний блок режиму «Відстань» (UI).
 * - чекає завантаження univers-бібліотеки;
 * - О1: лише вибір об’єкта (без категорії): Земля / Сонце / Сонячна система (до Оорта) / Чумацький Шлях;
 * - О2: вибір категорії та об’єкта (тільки ті, що мають distance_to_earth);
 * - слухає reset / user-objects-* / lang-changed;
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

// ключ категорії (узгоджений з адаптером)
function getCatKey(rec) {
  return low(rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

// валідні поля?
function hasDiameter(rec) {
  const v = Number(rec?.diameter?.value);
  return Number.isFinite(v) && v > 0;
}
function hasDistanceToEarth(rec) {
  const v = Number(rec?.distance_to_earth?.value);
  return Number.isFinite(v) && v > 0;
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

// Канонічний лейбл категорії: точна мова → en → ua → es → базове поле → key
function getCategoryLabelByKey(rows, key, lang) {
  const k = String(key || '').trim().toLowerCase();
  const inCat = Array.isArray(rows) ? rows.filter(r => getCatKey(r) === k) : [];
  if (inCat.length === 0) return norm(key);

  const prefs = [`category_${lang}`, 'category_en', 'category_ua', 'category_es', 'category'];
  for (const field of prefs) {
    for (const r of inCat) {
      const v = r && r[field] ? String(r[field]).trim() : '';
      if (v) return v;
    }
  }
  return norm(key);
}

// Чотири дозволені об'єкти О1 (будь-якою мовою)
const O1_ALLOWED_NAMES = [
  { ua: 'Земля', en: 'Earth', es: 'Tierra' },
  { ua: 'Сонце', en: 'Sun', es: 'Sol' },
  { ua: 'Сонячна система (до Оорта)', en: 'Solar System (to Oort Cloud)', es: 'Sistema Solar (hasta la Nube de Oort)' },
  { ua: 'Чумацький Шлях', en: 'Milky Way', es: 'Vía Láctea' }
];

function isAllowedO1(rec) {
  const names = [
    low(rec?.name_ua), low(rec?.name_en), low(rec?.name_es), low(rec?.name)
  ].filter(Boolean);
  for (const row of O1_ALLOWED_NAMES) {
    const set = new Set([low(row.ua), low(row.en), low(row.es)]);
    if (names.some(n => set.has(n))) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// Побудова списків

// О1: лише select об’єкта (без категорії)
function rebuildObject1Select(scope) {
  const lib  = getUniversLibrary() || [];
  const lang = getCurrentLang?.() || 'ua';
  const objSel = scope.querySelector('#distObject1');
  if (!objSel) return;

  // знайдемо відповідні офіційні записи (з діаметром)
  const candidates = lib.filter(hasDiameter).filter(isAllowedO1);

  const keep = norm(objSel.value);
  clearSelect(objSel);

  // placeholder для О1
  const ph = document.createElement('option');
  ph.value = '';
  ph.disabled = true;
  ph.selected = true;
  ph.hidden = true;
  ph.textContent = t('panel_placeholder_object1');
  objSel.appendChild(ph);

  // Додаємо опції у фіксованому порядку O1_ALLOWED_NAMES
  O1_ALLOWED_NAMES.forEach(want => {
    // знайдемо запис у бібліотеці, що збігається будь-якою мовою
    const hit = candidates.find(rec => {
      const n = [rec?.name_ua, rec?.name_en, rec?.name_es, rec?.name].map(low);
      const targets = [want.ua, want.en, want.es].map(low);
      return n.some(x => targets.includes(x));
    });
    if (!hit) return;
    const label = pickLang(hit, 'name', lang);
    if (label) addOption(objSel, label, label);
  });

  if (keep) objSel.value = keep;
}

// О2: категорія + об’єкт (тільки з distance_to_earth)
function rebuildCategorySelectO2(scope) {
  const lib  = getUniversLibrary() || [];
  const src  = Array.isArray(lib) ? lib.filter(hasDistanceToEarth) : [];
  const lang = getCurrentLang?.() || 'ua';
  const sel2 = scope.querySelector('#distCategoryObject2');
  if (!sel2) return;

  const keep = norm(sel2.value);
  clearSelect(sel2);

  // placeholder
  const ph = document.createElement('option');
  ph.value = '';
  ph.disabled = true;
  ph.selected = true;
  ph.hidden = true;
  ph.textContent = t('panel_placeholder_category');
  sel2.appendChild(ph);

  const keys = new Set();
  src.forEach(rec => {
    const k = getCatKey(rec);
    if (k) keys.add(k);
  });

  [...keys].sort().forEach(k => {
    const label = getCategoryLabelByKey(src, k, lang);
    addOption(sel2, k, label);
  });

  if (keep && [...keys].includes(keep)) sel2.value = keep;
}

function rebuildObjectsSelectO2(scope) {
  const lib  = getUniversLibrary() || [];
  const src  = Array.isArray(lib) ? lib.filter(hasDistanceToEarth) : [];
  const lang = getCurrentLang?.() || 'ua';

  const group  = scope.querySelector('.object2-group');
  const catSel = scope.querySelector('#distCategoryObject2');
  const objSel = scope.querySelector('#distObject2');
  if (!group || !objSel) return;

  const catKey = low(catSel?.value || '');

  // офіційні об’єкти цієї категорії (із distance_to_earth)
  const official = catKey ? src.filter(rec => getCatKey(rec) === catKey) : [];

  // юзерські (за текстовою категорією відповідною до поточної мови)
  const store = getStore();
  let userItems = [];
  if (catKey && typeof store?.list === 'function') {
    const catLabel = getCategoryLabelByKey(src, catKey, lang);
    const all = store.list('distance') || [];
    userItems = all.filter(o => low(o?.category || o?.category_i18n?.[o?.originalLang]) === low(catLabel));
  }

  const keep = norm(objSel.value);
  clearSelect(objSel);

  // placeholder О2
  const ph = document.createElement('option');
  ph.value = '';
  ph.disabled = true;
  ph.selected = true;
  ph.hidden = true;
  ph.textContent = t('panel_placeholder_object2');
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
function resetDistanceForm(scope) {
  // розблокувати О1 (на випадок якщо десь блокувався)
  scope.querySelector('.object1-group')?.classList.remove('is-locked');
  scope.querySelectorAll('.object1-group select, .object1-group input').forEach(el => {
    el.disabled = false;
    el.classList.remove('is-invalid');
  });

  // інпут діаметра + плейсхолдер
  const base = scope.querySelector('#distCircleObject1') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) {
    base.placeholder = t('panel_placeholder_input_diameter');
    base.value = '';
  }

  // перебудувати селекти
  rebuildObject1Select(scope);
  rebuildCategorySelectO2(scope);
  rebuildObjectsSelectO2(scope);
}

// ─────────────────────────────────────────────────────────────
// Публічний ініціалізатор

export async function initUniversDistanceBlock() {
  await loadUniversLibrary();

  const scope = document.getElementById('univers_distance');
  if (!scope) return;

  // стартове заповнення
  rebuildObject1Select(scope);
  rebuildCategorySelectO2(scope);
  rebuildObjectsSelectO2(scope);

  // плейсхолдер для інпута діаметра
  const base = scope.querySelector('#distCircleObject1') || scope.querySelector('[data-field="baseline-diameter"]');
  if (base) base.placeholder = t('panel_placeholder_input_diameter');
  if (base) attachO1QuickSuggest({ inputEl: base });

  // зміна категорії О2 → оновити список об’єктів
  scope.querySelector('#distCategoryObject2')?.addEventListener('change', () => {
    rebuildObjectsSelectO2(scope);
  });

  // події юзерських об'єктів → повна перебудова
  const rebuildAll = () => {
    rebuildObject1Select(scope);
    rebuildCategorySelectO2(scope);
    rebuildObjectsSelectO2(scope);
  };
  document.addEventListener('user-objects-added', rebuildAll);
  document.addEventListener('user-objects-changed', rebuildAll);
  document.addEventListener('user-objects-removed', rebuildAll);

  // ЗМІНА МОВИ ПІД ЧАС СЕСІЇ:
  const onLangChange = () => rebuildAll();
  document.addEventListener('languageChanged', onLangChange);
  window.addEventListener('languageChanged', onLangChange);
  document.addEventListener('lang-changed', onLangChange);
  window.addEventListener('lang-changed', onLangChange);

  // системний Reset → локально очистити форму/стан режиму
  document.addEventListener('reset', () => resetDistanceForm(scope));

  console.log('[mode:distance] init OK');
}

// (опційно для тестів)
export { rebuildObject1Select, rebuildCategorySelectO2, rebuildObjectsSelectO2, resetDistanceForm };
