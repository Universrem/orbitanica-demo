// /js/blocks/univers_distance.js
'use strict';

/**
 * Блок режиму «Відстань» (UI).
 * - O1: фіксований список із бібліотеки діаметрів + поле діаметра (#distCircleObject1) + селектор пресетів (#distBaselinePreset).
 * - O2: категорії та об'єкти з мердженої бібліотеки «distance» (офіційні + користувацькі).
 * - Лейбли локалізовані; для UGC додаємо « (корист.)».
 * - Для кожного option О2 прикріплюємо snapshot у dataset.snapshot.
 */

import { t, getCurrentLang } from '../i18n.js';
import { loadUniversLibrary, getUniversLibrary } from '../data/univers_lib.js';
import { onDistanceCalculate } from '../events/distance_buttons.js';
import { attachO1QuickSuggest } from '../utils/o1QuickSuggest.js';

/* ─────────────────────────────────────────────────────────────
   Утіліти
───────────────────────────────────────────────────────────── */

const SUP_LANGS = ['ua', 'en', 'es'];
const s = v => String(v ?? '').trim();
const low = v => s(v).toLowerCase();

function currentLangBase() {
  const raw = (getCurrentLang && getCurrentLang()) || '';
  const base = String(raw).toLowerCase().split(/[-_]/)[0];
  return SUP_LANGS.includes(base) ? base : 'ua';
}

function hasValidDiameter(rec) {
  const v = Number(rec?.diameter?.value);
  return Number.isFinite(v) && v > 0;
}

function hasValidDistance(rec) {
  const v = Number(rec?.distance_to_earth?.value);
  return Number.isFinite(v) && v > 0;
}

function isUser(rec) {
  return !!(rec?.is_user_object || rec?.source === 'user');
}

function getCatKey(rec) {
  return low(rec?.category_key ?? rec?.category_id ?? rec?.category_en ?? rec?.category ?? '');
}

function pickName(rec, lang) {
  return s(rec?.[`name_${lang}`] ?? rec?.name ?? '');
}

function pickCategoryI18n(rec) {
  return {
    ua: s(rec?.category_ua ?? rec?.category_i18n?.ua),
    en: s(rec?.category_en ?? rec?.category_i18n?.en),
    es: s(rec?.category_es ?? rec?.category_i18n?.es),
  };
}

function pickCategoryLabel(i18n, lang) {
  if (lang === 'ua' && i18n.ua) return i18n.ua;
  if (lang === 'en' && i18n.en) return i18n.en;
  if (lang === 'es' && i18n.es) return i18n.es;
  return i18n.ua || i18n.en || i18n.es || '';
}

function clearSelect(el) {
  if (!el) return;
  el.innerHTML = '';
}

function attachSnapshot(opt, rec) {
  if (!opt || !rec || !hasValidDistance(rec)) return;
  const d = rec.distance_to_earth;
  const snap = {
    id: rec?.id ?? null,
    category_key: rec?.category_key ?? rec?.category_id ?? null,
    value: Number(d?.value),
    unit: s(d?.unit),
    name_ua: rec?.name_ua ?? null,
    name_en: rec?.name_en ?? null,
    name_es: rec?.name_es ?? null,
    description_ua: rec?.description_ua ?? null,
    description_en: rec?.description_en ?? null,
    description_es: rec?.description_es ?? null,
  };
  if (!Number.isFinite(snap.value) || !snap.value || !snap.unit) return;
  try { opt.dataset.snapshot = JSON.stringify(snap); } catch {}
  if (isUser(rec)) opt.dataset.user = '1';
}

function getSelectedSnapshotId(sel) {
  if (!sel) return '';
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return '';
  try {
    const snap = JSON.parse(opt.dataset.snapshot || '{}');
    return snap.id ? String(snap.id) : '';
  } catch { return ''; }
}

/* ─────────────────────────────────────────────────────────────
   O1 (базовий об’єкт + діаметр + пресети)
───────────────────────────────────────────────────────────── */

const O1_CANDIDATES = [
  { ua: 'Земля', en: 'Earth', es: 'Tierra' },
  { ua: 'Сонце', en: 'Sun', es: 'Sol' },
  { ua: 'Сонячна система (до Оорта)', en: 'Solar System (to Oort Cloud)', es: 'Sistema Solar (hasta la Nube de Oort)' },
  { ua: 'Чумацький Шлях', en: 'Milky Way', es: 'Vía Láctea' },
];

// якщо у вас є стабільні id офіційних об’єктів — краще звіряти по id
function matchByNames(rec, cand) {
  const names = new Set([rec?.name_ua, rec?.name_en, rec?.name_es, rec?.name].map(low).filter(Boolean));
  const targets = new Set([cand.ua, cand.en, cand.es].map(low));
  for (const n of names) if (targets.has(n)) return true;
  return false;
}

function rebuildO1(scope) {
  const sel = scope.querySelector('#distObject1');
  if (!sel) return;
  const lang = currentLangBase();

  const lib = (getUniversLibrary('diameter') || []).filter(hasValidDiameter);
  const prev = s(sel.value);

  clearSelect(sel);

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('panel_placeholder_object1');
  placeholder.disabled = true; placeholder.selected = true; placeholder.hidden = true;
  sel.appendChild(placeholder);

  const opts = [];
  for (const cand of O1_CANDIDATES) {
    const rec = lib.find(r => matchByNames(r, cand));
    if (!rec) continue;
    const label = pickName(rec, lang);
    if (!label) continue;
    const opt = document.createElement('option');
    opt.value = label;      // для О1 у вас value = назва (історично)
    opt.textContent = label;
    opts.push(opt);
  }
  for (const o of opts) sel.appendChild(o);
  if (prev) sel.value = prev;

  // Поле діаметра — placeholder + quick-suggest (уніфіковано як в інших режимах)
  const base = scope.querySelector('#distCircleObject1') ||
               scope.querySelector('[data-field="baseline-diameter"]');
  if (base) {
    base.placeholder = t('panel_placeholder_input_diameter');
    try { attachO1QuickSuggest({ inputEl: base, modeId: 'univers_distance' }); } catch {}
  }

  // Пресети базового діаметра (опційний селектор)
  setupBaselinePresets(scope);
}

// Значення пресетів (у метрах). Не примусові: якщо у селекті вже задані — не перезаписуємо.
function setupBaselinePresets(scope) {
  const presetSel = scope.querySelector('#distBaselinePreset, [data-role="baseline-preset"]');
  const input = scope.querySelector('#distCircleObject1, [data-field="baseline-diameter"]');
  if (!presetSel || !input) return;

  // якщо у селектора немає жодної опції, не чіпаємо — ніяких автододавань
  if (presetSel.options.length === 0) return;

  const onPresetChange = () => {
    const val = String(presetSel.value || '').trim();
    if (!val || val === '__custom__') return;
    input.value = val;
  };

  const onInputChange = () => {
    const v = String(input.value || '').trim();
    if (!v) return;
    const match = [...presetSel.options].find(o => o.value === v);
    presetSel.value = match ? match.value : '__custom__';
  };

  presetSel.removeEventListener('change', onPresetChange);
  presetSel.addEventListener('change', onPresetChange);

  input.removeEventListener('input', onInputChange);
  input.addEventListener('input', onInputChange);

  // початкова синхронізація тільки якщо є збіг
  const v0 = String(input.value || '').trim();
  const match0 = [...presetSel.options].find(o => o.value === v0);
  presetSel.value = match0 ? match0.value : presetSel.value;
}

/* ─────────────────────────────────────────────────────────────
   O2: категорії
───────────────────────────────────────────────────────────── */

function rebuildO2Categories(scope) {
  const sel = scope.querySelector('#distCategoryObject2');
  if (!sel) return;
  const lang = currentLangBase();

  const lib = (getUniversLibrary('distance') || []).filter(hasValidDistance);

  // Групуємо за ключем
  const byKey = new Map();
  for (const rec of lib) {
    const key = getCatKey(rec);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(rec);
  }

  // Категорії показуємо тільки якщо є хоч один об’єкт із назвою на поточній мові
  const categories = [];
  for (const [key, arr] of byKey.entries()) {
    const hasAnyNameInLang = arr.some(r => !!pickName(r, lang));
    if (!hasAnyNameInLang) continue;

    // Витягаємо локалізовану назву категорії
    let catI18n = null;
    for (const r of arr) {
      const cand = pickCategoryI18n(r);
      if (cand.ua || cand.en || cand.es) { catI18n = cand; break; }
    }
    const labelBase = pickCategoryLabel(catI18n || {}, lang);
    if (!labelBase) continue;

    // позначаємо категорію як «корист.» якщо в ній є хоча б 1 UGC
    const hasUser = arr.some(isUser);
    const userMark = hasUser ? ` ${t('ui.user_mark') || '(корист.)'}` : '';
    categories.push({ key, label: `${labelBase}${userMark}` });
  }

  categories.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  const prev = s(sel.value);
  clearSelect(sel);

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('panel_placeholder_category');
  placeholder.disabled = true; placeholder.selected = true; placeholder.hidden = true;
  sel.appendChild(placeholder);

  const frag = document.createDocumentFragment();
  for (const c of categories) {
    const opt = document.createElement('option');
    opt.value = c.key;
    opt.textContent = c.label;
    frag.appendChild(opt);
  }
  sel.appendChild(frag);

  if (prev && categories.some(c => c.key === prev)) sel.value = prev;
}

/* ─────────────────────────────────────────────────────────────
   O2: об’єкти в категорії
───────────────────────────────────────────────────────────── */

function rebuildO2Objects(scope) {
  const catSel = scope.querySelector('#distCategoryObject2');
  const objSel = scope.querySelector('#distObject2');
  if (!catSel || !objSel) return;
  const lang = currentLangBase();

  const catKey = low(catSel.value || '');
  const prevId = getSelectedSnapshotId(objSel);

  clearSelect(objSel);
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = t('panel_placeholder_object2');
  ph.disabled = true; ph.selected = true; ph.hidden = true;
  objSel.appendChild(ph);
  if (!catKey) return;

  const lib = (getUniversLibrary('distance') || []).filter(hasValidDistance);
  const inCat = lib.filter(r => getCatKey(r) === catKey);

  // Формуємо список: value = id (фолбек name), label локалізований (+ (корист.))
  const items = [];
  for (const rec of inCat) {
    const name = pickName(rec, lang);
    if (!name) continue;
    const value = String(rec?.id || name);
    const label = isUser(rec) ? `${name} ${t('ui.user_mark') || '(корист.)'}` : name;
    items.push({ value, label, rec });
  }

  // Уникнути дублів за value
  const seen = new Set();
  const frag = document.createDocumentFragment();
  for (const it of items) {
    if (seen.has(it.value)) continue;
    seen.add(it.value);
    const opt = document.createElement('option');
    opt.value = it.value;
    opt.textContent = it.label;
    attachSnapshot(opt, it.rec);
    frag.appendChild(opt);
  }
  objSel.appendChild(frag);

  // Відновлення вибору за snapshot.id
  if (prevId) {
    const match = [...objSel.options].find(o => {
      try { return JSON.parse(o.dataset.snapshot || '{}').id === prevId; }
      catch { return false; }
    });
    if (match) objSel.value = match.value;
  }
}

/* ─────────────────────────────────────────────────────────────
   Скидання форми
───────────────────────────────────────────────────────────── */

function resetDistanceForm(scope) {
  const o1Group = scope.querySelector('.object1-group');
  if (o1Group) {
    o1Group.classList.remove('is-locked');
    o1Group.querySelectorAll('select, input').forEach(el => { el.disabled = false; el.classList.remove('is-invalid'); });
  }
  const input = scope.querySelector('#distCircleObject1') || scope.querySelector('[data-field="baseline-diameter"]');
  if (input) {
    input.placeholder = t('panel_placeholder_input_diameter');
    input.value = '';
  }
  rebuildO1(scope);
  rebuildO2Categories(scope);
  rebuildO2Objects(scope);
}

/* ─────────────────────────────────────────────────────────────
   Публічна калькуляція (для аплайєра)
───────────────────────────────────────────────────────────── */

export function recalculate() {
  const scope = document.getElementById('univers_distance') || document;
  try { onDistanceCalculate({ scope }); } catch (e) { console.error('[distance] recalculate failed:', e); }
}

/* ─────────────────────────────────────────────────────────────
   Ініціалізація / Teardown
───────────────────────────────────────────────────────────── */

let __inited = false;
let __teardown = null;

export async function initUniversDistanceBlock() {
  if (__inited) return;
  __inited = true;

  try {
    await Promise.all([ loadUniversLibrary('distance'), loadUniversLibrary('diameter') ]);
  } catch (e) {
    console.error('[distance] univers libraries load failed:', e);
  }

  const scope = document.getElementById('univers_distance');
  if (!scope) { console.warn('[distance] #univers_distance not found'); return; }

  rebuildO1(scope);
  rebuildO2Categories(scope);
  rebuildO2Objects(scope);

  const onCatChange = () => rebuildO2Objects(scope);
  const catSel = scope.querySelector('#distCategoryObject2');
  if (catSel) catSel.addEventListener('change', onCatChange);

  const onLibReload = (e) => {
    const m = e?.detail?.mode;
    if (m && m !== 'distance' && m !== 'diameter') return;
    rebuildO1(scope);
    rebuildO2Categories(scope);
    rebuildO2Objects(scope);
  };

  const onLang = () => {
    rebuildO1(scope);
    rebuildO2Categories(scope);
    rebuildO2Objects(scope);
  };

  const onUiReset = () => resetDistanceForm(scope);

  document.addEventListener('univers-lib-reloaded', onLibReload);
  document.addEventListener('user-objects-updated', onLibReload);
  document.addEventListener('user-objects-removed', onLibReload);

  document.addEventListener('languageChanged', onLang);
  document.addEventListener('lang-changed', onLang);
  document.addEventListener('i18nextLanguageChanged', onLang);
  document.addEventListener('i18n:ready', onLang);

  window.addEventListener('orbit:ui-reset', onUiReset);

  __teardown = () => {
    if (catSel) catSel.removeEventListener('change', onCatChange);
    document.removeEventListener('univers-lib-reloaded', onLibReload);
    document.removeEventListener('user-objects-updated', onLibReload);
    document.removeEventListener('user-objects-removed', onLibReload);
    document.removeEventListener('languageChanged', onLang);
    document.removeEventListener('lang-changed', onLang);
    document.removeEventListener('i18nextLanguageChanged', onLang);
    document.removeEventListener('i18n:ready', onLang);
    window.removeEventListener('orbit:ui-reset', onUiReset);
    __inited = false;
  };

  console.log('[mode:distance] UI initialized');
}

export function disposeUniversDistanceBlock() {
  if (typeof __teardown === 'function') __teardown();
}

/* Експорти для тестів */
export {
  rebuildO1 as rebuildObject1Selection,
  rebuildO2Categories as rebuildCategorySelectionO2,
  rebuildO2Objects as rebuildObjectsSelectionO2,
  resetDistanceForm
};
