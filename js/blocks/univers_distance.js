// /js/blocks/univers_distance.js
'use strict';

/**
 * Блок режиму «Відстань» (UI).
 * - O1: Земля / Сонце / Сонячна система (до Оорта) / Чумацький Шлях з бібліотеки діаметрів (мають diameter).
 * - O2: категорії та об'єкти з бібліотеки дистанцій (мають distance_to_earth) + користувацькі.
 * - У селектах показуємо ТІЛЬКИ назви поточною мовою. Якщо назви категорії мовою немає — показуємо назву на іншій доступній мові (ua→en→es), але НЕ ключ.
 *
 * ДОДАНО:
 *  • snapshot у dataset для кожного option О2 (id, category_key, value, unit, name_*).
 *  • публічний recalculate() — викликає стандартний обробник режиму.
 */

import { t, getCurrentLang } from '../i18n.js';
import { loadUniversLibrary, getUniversLibrary } from '../data/univers_lib.js';
import { getStore } from '../userObjects/api.js';
import { attachO1QuickSuggest } from '../utils/o1QuickSuggest.js';
import { onDistanceCalculate } from '../events/distance_buttons.js';

// ─────────────────────────────────────────────────────────────
// Константи та утіліти

const SUPPORTED_LANGUAGES = ['ua', 'en', 'es'];
const O1_ALLOWED_NAMES = [
  { ua: 'Земля', en: 'Earth', es: 'Tierra' },
  { ua: 'Сонце', en: 'Sun', es: 'Sol' },
  { ua: 'Сонячна система (до Оорта)', en: 'Solar System (to Oort Cloud)', es: 'Sistema Solar (hasta la Nube de Oort)' },
  { ua: 'Чумацький Шлях', en: 'Milky Way', es: 'Vía Láctea' }
];

const s = v => String(v ?? '').trim();
const low = v => s(v).toLowerCase();

function stripUserMark(label) {
  const mark = t('ui.user_mark') || '(корист.)';
  return s(label).replace(new RegExp(String(mark).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '').trim();
}

// нормалізуємо es-ES → es, і т.п. Якщо мова не з SUPPORTED_LANGUAGES — нічого не будуємо.
function getLangSafe() {
  const raw = (getCurrentLang && getCurrentLang()) || '';
  const base = String(raw).toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(base) ? base : '';
}

function isUserObject(o) {
  return !!(o?.is_user_object || o?.source === 'user');
}

function hasValidDiameter(o) {
  const v = Number(o?.diameter?.value);
  return Number.isFinite(v) && v > 0;
}

function hasValidDistanceToEarth(o) {
  const v = Number(o?.distance_to_earth?.value);
  return Number.isFinite(v) && v > 0;
}

// ключ категорії — slug/ідентифікатор, НЕ текст
function getCategoryKey(rec) {
  return low(rec?.category_key ?? rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

function clearSelect(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

function addOpt(sel, value, label, isPlaceholder = false) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  if (isPlaceholder) {
    opt.disabled = true;
    opt.selected = true;
    opt.hidden = true;
  }
  sel.appendChild(opt);
  return opt; // повертаємо option для подальшого dataset.snapshot
}

// Назва об'єкта поточною мовою (для юзерів також name_i18n)
function getLangName(obj, lang) {
  const i18n = obj?.name_i18n?.[lang];
  const direct = obj?.[`name_${lang}`];
  const legacy = (obj?.originalLang === lang) ? obj?.name : '';
  return s(i18n || direct || legacy || '');
}

// Вибір підпису з i18n для категорії: поточна мова або fallback ua→en→es (без ключа!)
function pickCategoryLabel(i18n, lang) {
  const ua = s(i18n?.ua);
  const en = s(i18n?.en);
  const es = s(i18n?.es);
  if (lang === 'ua' && ua) return ua;
  if (lang === 'en' && en) return en;
  if (lang === 'es' && es) return es;
  return ua || en || es || ''; // НІКОЛИ не повертаємо slug
}

// Назва категорії поточною мовою (для юзерів також category_i18n); без fallback
function getLangCategory(obj, lang) {
  const i18n = obj?.category_i18n?.[lang];
  const direct = obj?.[`category_${lang}`];
  return s(i18n || direct || '');
}

// Побудувати i18n пак для офіційної категорії з масиву її записів
function collectOfficialCategoryI18N(recordsInKey) {
  let ua = '', en = '', es = '';
  for (const r of recordsInKey) {
    if (!ua) ua = s(r?.category_ua);
    if (!en) en = s(r?.category_en);
    if (!es) es = s(r?.category_es);
    if (ua && en && es) break;
  }
  return { ua: ua || null, en: en || null, es: es || null };
}

function isAllowedO1Object(rec) {
  const names = new Set([rec?.name_ua, rec?.name_en, rec?.name_es, rec?.name].map(low).filter(Boolean));
  return O1_ALLOWED_NAMES.some(allowed => {
    const targets = new Set([allowed.ua, allowed.en, allowed.es].map(low));
    for (const n of names) if (targets.has(n)) return true;
    return false;
  });
}

// ─────────────────────────────────────────────────────────────
// Snapshot helpers (для option О2)

function makeSnapshotFromLibRecord(rec) {
  if (!rec || !hasValidDistanceToEarth(rec)) return null;
  const d = rec.distance_to_earth;
  return {
    id: rec?.id ?? null,
    category_key: rec?.category_key ?? rec?.category_id ?? null,
    value: Number(d?.value),
    unit: d?.unit ?? null,
    name_ua: rec?.name_ua ?? null,
    name_en: rec?.name_en ?? null,
    name_es: rec?.name_es ?? null,
    description_ua: rec?.description_ua ?? null,
    description_en: rec?.description_en ?? null,
    description_es: rec?.description_es ?? null,
  };
}

function attachSnapshotToOption(opt, rec) {
  if (!opt || !rec) return;
  try {
    const snap = makeSnapshotFromLibRecord(rec);
    if (!snap || !Number.isFinite(Number(snap.value)) || !snap.unit) return;
    opt.dataset.snapshot = JSON.stringify(snap);
  } catch (e) {
    console.warn('[distance] snapshot attach failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// O1: 4 об'єкти

function rebuildObject1Selection(scope) {
  const lib = getUniversLibrary('diameter') || [];
  const lang = getLangSafe(); if (!lang) return;
  const sel = scope.querySelector('#distObject1');
  if (!sel) return;

  const valid = lib.filter(hasValidDiameter).filter(isAllowedO1Object);
  const current = s(sel.value);

  clearSelect(sel);
  addOpt(sel, '', t('panel_placeholder_object1'), true);

  // рівно 4 у фіксованому порядку, тільки якщо є назва поточною мовою
  O1_ALLOWED_NAMES.forEach(allowed => {
    const rec = valid.find(r => {
      const recordNames = [r?.name_ua, r?.name_en, r?.name_es, r?.name].map(low);
      const targetNames = [allowed.ua, allowed.en, allowed.es].map(low);
      return recordNames.some(n => targetNames.includes(n));
    });
    if (!rec) return;
    const label = s(rec?.[`name_${lang}`] || '');
    if (label) addOpt(sel, label, label);
  });

  if (current) sel.value = current;
}

// ─────────────────────────────────────────────────────────────
// O2: категорії + об'єкти

function rebuildCategorySelectionO2(scope) {
  const lib = getUniversLibrary('distance') || [];
  const valid = Array.isArray(lib) ? lib.filter(hasValidDistanceToEarth) : [];
  const lang = getLangSafe(); if (!lang) return;
  const sel = scope.querySelector('#distCategoryObject2');
  if (!sel) return;

  const current = s(sel.value);
  clearSelect(sel);
  addOpt(sel, '', t('panel_placeholder_category'), true);

  // офіційні категорії
  const officialCategories = new Set();
  valid.forEach(r => {
    if (!isUserObject(r)) {
      const key = getCategoryKey(r);
      if (key) officialCategories.add(key);
    }
  });

  // юзерські об’єкти (масив нормалізованих з api.js)
  let userObjects = [];
  try {
    const store = getStore();
    userObjects = (typeof store.list === 'function') ? (store.list('distance') || []) : [];
  } catch (e) {
    console.warn('[distance] failed to load user objects for categories:', e);
  }

  // зібрати ключі категорій, що мають бодай один об’єкт з назвою поточною мовою
  const categoryKeys = new Set();

  // офіційні: key -> масив офіційних записів
  const byKey = new Map();
  valid.forEach(r => {
    if (isUserObject(r)) return;
    const key = getCategoryKey(r);
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  });
  for (const [key, arr] of byKey.entries()) {
    const hasNameInLang = arr.some(r => s(r?.[`name_${lang}`] || '') !== '');
    if (hasNameInLang) categoryKeys.add(key);
  }

  // юзерські: key -> масив юзерських
  const userByKey = new Map();
  userObjects.forEach(u => {
    const key = low(u?.category_key);
    if (!key) return;
    if (!userByKey.has(key)) userByKey.set(key, []);
    userByKey.get(key).push(u);
  });
  for (const [key, arr] of userByKey.entries()) {
    const hasNameInLang = arr.some(u => getLangName(u, lang));
    if (hasNameInLang) categoryKeys.add(key);
  }

  // побудувати label: офіційна → pickCategoryLabel(зібраний i18n), юзерська → pickCategoryLabel(u.category_i18n, lang) + (корист.)
  const keysSorted = Array.from(categoryKeys).sort();
  keysSorted.forEach(key => {
    let label = '';

    if (officialCategories.has(key)) {
      const arr = byKey.get(key) || [];
      const i18n = collectOfficialCategoryI18N(arr);
      label = pickCategoryLabel(i18n, lang);
    } else {
      const arr = userByKey.get(key) || [];
      // беремо перший, де хоч щось є у category_i18n/category_*
      let i18n = null;
      for (const u of arr) {
        const cand = {
          ua: s(u?.category_i18n?.ua ?? u?.category_ua),
          en: s(u?.category_i18n?.en ?? u?.category_en),
          es: s(u?.category_i18n?.es ?? u?.category_es),
        };
        if (cand.ua || cand.en || cand.es) { i18n = cand; break; }
      }
      label = pickCategoryLabel(i18n || {}, lang);
      const userMark = t('ui.user_mark') || '(корист.)';
      label = `${label} ${userMark}`.trim();
    }

    // Якщо раптом нема жодної назви — пропускаємо категорію (НЕ показуємо ключ)
    if (!label) return;

    addOpt(sel, key, label);
  });

  if (current && categoryKeys.has(current)) sel.value = current;
}

function rebuildObjectsSelectionO2(scope, newObject = null) {
  const lib = getUniversLibrary('distance') || [];
  const valid = Array.isArray(lib) ? lib.filter(hasValidDistanceToEarth) : [];
  const lang = getLangSafe(); if (!lang) return;

  const group  = scope.querySelector('.object2-group');
  const catSel = scope.querySelector('#distCategoryObject2');
  const objSel = scope.querySelector('#distObject2');
  if (!group || !objSel || !catSel) return;

  const key = low(catSel.value || '');
  const prev = s(objSel.value);

  clearSelect(objSel);
  addOpt(objSel, '', t('panel_placeholder_object2'), true);
  if (!key) return;

  // офіційні об'єкти в категорії — тільки з назвою поточною мовою
  const officialInCat = valid
    .filter(r => !isUserObject(r) && getCategoryKey(r) === key)
    .map(r => {
      const name = s(r?.[`name_${lang}`] || '');
      return name ? { label: name, value: name, rec: r } : null; // value = назва
    })
    .filter(Boolean);

  // юзерські об'єкти в категорії — тільки з назвою поточною мовою; додаємо «(корист.)»
  let userInCat = [];
  try {
    const store = getStore();
    const all = (typeof store.list === 'function') ? (store.list('distance') || []) : [];
    userInCat = all
      .filter(u => low(u?.category_key) === key)
      .map(u => {
        const name = getLangName(u, lang);
        if (!name) return null;
        const mark = t('ui.user_mark') || '(корист.)';
        return { label: `${name} ${mark}`, value: name, rec: u }; // value = назва
      })
      .filter(Boolean);
  } catch (e) {
    console.warn('[distance] failed to load user objects for objects-select:', e);
  }

  // миттєво додаємо щойно створений об'єкт (до появи у store)
  if (newObject && low(newObject.category_key) === key) {
    const freshName = getLangName(newObject, lang);
    if (freshName) {
      const mark = t('ui.user_mark') || '(корист.)';
      userInCat.unshift({ label: `${freshName} ${mark}`, value: freshName, rec: newObject });
    }
  }

  // уникаємо дублів за value (назва) і одночасно прикріплюємо snapshot
  const seen = new Set();
  [...officialInCat, ...userInCat].forEach(item => {
    if (seen.has(item.value)) return;
    seen.add(item.value);
    const opt = addOpt(objSel, item.value, item.label);
    // Для юзерського запису може не бути lib-подібної структури — спробуємо знайти її у merged lib
    let rec = item.rec;
    if (!rec || !hasValidDistanceToEarth(rec)) {
      rec = valid.find(r => getCategoryKey(r) === key && low(s(r?.[`name_${lang}`] || '')) === low(stripUserMark(item.label)));
    }
    attachSnapshotToOption(opt, rec);
  });

  // автоселекція
  if (newObject && low(newObject.category_key) === key) {
    const newName = getLangName(newObject, lang);
    if (newName) objSel.value = newName;
  } else if (prev) {
    objSel.value = prev;
  }
}

// ─────────────────────────────────────────────────────────────
// Скидання

function resetDistanceForm(scope) {
  // Скидаємо стан О1
  const object1Group = scope.querySelector('.object1-group');
  if (object1Group) {
    object1Group.classList.remove('is-locked');
    object1Group.querySelectorAll('select, input').forEach(el => {
      el.disabled = false;
      el.classList.remove('is-invalid');
    });
  }

  // Плейсхолдер базового діаметра
  const diameterInput = scope.querySelector('#distCircleObject1') ||
                        scope.querySelector('[data-field="baseline-diameter"]');
  if (diameterInput) {
    diameterInput.placeholder = t('panel_placeholder_input_diameter');
    diameterInput.value = '';
  }

  // Перебудова
  rebuildObject1Selection(scope);
  rebuildCategorySelectionO2(scope);
  rebuildObjectsSelectionO2(scope);
}

// ─────────────────────────────────────────────────────────────
// Події

function handleUserObjectsAdded(event) {
  const { mode, object, slot } = event.detail || {};
  if (mode !== 'distance' || slot !== 'object2' || !object) return;

  event.stopImmediatePropagation();

  const scope = document.getElementById('univers_distance');
  if (!scope) return;

  const catSel = scope.querySelector('#distCategoryObject2');
  const objSel = scope.querySelector('#distObject2');
  if (!catSel || !objSel) return;

  // Спершу перебудуємо категорії, щоб нова категорія точно була в селекті
  rebuildCategorySelectionO2(scope);

  const key = low(object.category_key || '');
  // Якщо після ребілду такої категорії ще немає — додамо тимчасову опцію з назвою (без slug)
  if (![...catSel.options].some(o => low(o.value) === key)) {
    const lang = getLangSafe();
    const i18n = {
      ua: s(object?.category_i18n?.ua ?? object?.category_ua),
      en: s(object?.category_i18n?.en ?? object?.category_en),
      es: s(object?.category_i18n?.es ?? object?.category_es),
    };
    let label = pickCategoryLabel(i18n, lang);
    const userMark = t('ui.user_mark') || '(корист.)';
    label = label ? `${label} ${userMark}`.trim() : ''; // якщо навіть тут нема назви — не показуємо ключ
    if (label) addOpt(catSel, key, label);
  }
  catSel.value = key;

  // Тепер перебудуємо об'єкти з урахуванням свіжого об'єкта
  rebuildObjectsSelectionO2(scope, object);
}

function handleLanguageChange() {
  const scope = document.getElementById('univers_distance');
  if (!scope) return;
  rebuildObject1Selection(scope);
  rebuildCategorySelectionO2(scope);
  rebuildObjectsSelectionO2(scope);
}

function handleUniversLibraryReloaded(event) {
  const mode = event?.detail?.mode;
  if (mode && mode !== 'distance' && mode !== 'diameter') return;

  const scope = document.getElementById('univers_distance');
  if (!scope) return;

  rebuildObject1Selection(scope);
  rebuildCategorySelectionO2(scope);
  rebuildObjectsSelectionO2(scope);
}

function handleReset() {
  const scope = document.getElementById('univers_distance');
  if (scope) resetDistanceForm(scope);
}

// ─────────────────────────────────────────────────────────────
// Публічна калькуляція для аплайєра

export function recalculate() {
  try {
    const scope = document.getElementById('univers_distance') || document;
    onDistanceCalculate({ scope });
  } catch (e) {
    console.error('[distance] recalculate() failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// Ініціалізація

export async function initUniversDistanceBlock() {
  try {
    await Promise.all([
      loadUniversLibrary('distance'),
      loadUniversLibrary('diameter'),
    ]);
  } catch (error) {
    console.error('[distance] Failed to load univers libraries:', error);
    return;
  }

  const scope = document.getElementById('univers_distance');
  if (!scope) {
    console.warn('[distance] Scope element not found');
    return;
  }

  const initForm = () => {
    rebuildObject1Selection(scope);
    rebuildCategorySelectionO2(scope);
    rebuildObjectsSelectionO2(scope);

    const diameterInput = scope.querySelector('#distCircleObject1') ||
                          scope.querySelector('[data-field="baseline-diameter"]');
    if (diameterInput) {
      diameterInput.placeholder = t('panel_placeholder_input_diameter');
      attachO1QuickSuggest({ inputEl: diameterInput });
    }
  };

  initForm();

  const categorySelect = scope.querySelector('#distCategoryObject2');
  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      rebuildObjectsSelectionO2(scope);
    });
  }

  // тільки document — без дублю на window
  document.addEventListener('user-objects-added', handleUserObjectsAdded);
  document.addEventListener('user-objects-changed', initForm);
  document.addEventListener('user-objects-removed', initForm);
  document.addEventListener('univers-lib-reloaded', handleUniversLibraryReloaded);
  document.addEventListener('languageChanged', handleLanguageChange);
  document.addEventListener('lang-changed', handleLanguageChange);
  document.addEventListener('reset', handleReset);
  document.addEventListener('user-objects-updated', handleUniversLibraryReloaded);

  console.log('[mode:distance] Initialization completed successfully');
}

// Експорт для тестів
export {
  rebuildObject1Selection,
  rebuildCategorySelectionO2,
  rebuildObjectsSelectionO2,
  resetDistanceForm
};
