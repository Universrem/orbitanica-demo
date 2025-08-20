// full/js/blocks/univers_diameter.js
'use strict';

import { getCurrentLang, t } from '../i18n.js';
import { getStore } from '../userObjects/api.js';
import { loadUniverseLibrary, getUniverseLibrary } from '../data/universe.js';

/**
 * Головна ініціалізація блоку "Діаметр"
 */
export async function initUniversDiameterBlock() {
  await loadUniverseLibrary();

  // 1) заповнити категорії (офіційні + користувацькі)
  updateCategories();

  // 2) прив’язати зміни категорій до оновлення списків об’єктів
  const cat1 = document.getElementById('diamCategoryObject1');
  const cat2 = document.getElementById('diamCategoryObject2');

  cat1?.addEventListener('change', () => rebuildForSlot('object1'));
  cat2?.addEventListener('change', () => rebuildForSlot('object2'));

  // 3) первинне наповнення списків об’єктів
  rebuildObjectsForSelectedCategories();

  // 4) реакція на додавання/зміну юзер-об’єктів
  document.addEventListener('user-objects-added', (e) => {
    const d = e.detail || {};
    if (d.mode !== 'diameter' || !d.object) return;

    // оновлюємо категорії та обидва списки
    updateCategories();
    rebuildObjectsForSelectedCategories();

    // підставляємо нову категорію у відповідний слот і обираємо новий об’єкт
    const lang = getCurrentLang();
    const slot = d.slot === 'object1' ? 'object1' : 'object2';
    const catId = slot === 'object1' ? 'diamCategoryObject1' : 'diamCategoryObject2';
    const objId = slot === 'object1' ? 'diamObject1' : 'diamObject2';

    const catSel = document.getElementById(catId);
    const objSel = document.getElementById(objId);

    const cat =
      d.object.category ||
      d.object.category_i18n?.[lang] ||
      d.object.category_i18n?.[d.object.originalLang] || '';

    const name =
      d.object.name ||
      d.object.name_i18n?.[lang] ||
      d.object.name_i18n?.[d.object.originalLang] || '';

    if (catSel && cat) catSel.value = cat;
    rebuildForSlot(slot);
    if (objSel && name) objSel.value = name;
  });

  document.addEventListener('user-objects-changed', () => {
    updateCategories();
    rebuildObjectsForSelectedCategories();
  });

  // після "Скинути" просто перебудувати списки (юзер-дані з localStorage не зникають)
  document.addEventListener('click', (e) => {
    const btn = e.target;
    if (!(btn instanceof HTMLElement)) return;
    if (btn.id !== 'reset') return;
    const block = btn.closest('#univers_diameter');
    if (!block) return;
    setTimeout(() => {
      updateCategories();
      rebuildObjectsForSelectedCategories();
    }, 0);
  });

  // зміна мови: перезавантажуємо бібліотеку і перебудовуємо все
  document.addEventListener('languageChanged', async () => {
    updateCategories();
    rebuildObjectsForSelectedCategories();
  });
}

// ─────────────────────────────────────────────

function updateCategories() {
  const universeLibrary = getUniverseLibrary();

  const lang = getCurrentLang();
  const set = new Set();

  // офіційні
  universeLibrary.forEach(o => {
    const c = o[`category_${lang}`];
    if (c) set.add(c);
  });

  // користувацькі
  try {
    (getStore().list('diameter') || []).forEach(u => {
      const c =
        (typeof u.category === 'string' && u.category) ||
        (u.category_i18n && (u.category_i18n[lang] || u.category_i18n[u.originalLang]));
      if (c) set.add(c);
    });
  } catch {}

  const categories = Array.from(set).sort();

  ['diamCategoryObject1', 'diamCategoryObject2'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;

    const prev = sel.value;
    sel.innerHTML = '';

    const ph = document.createElement('option');
    ph.value = ''; ph.disabled = true; ph.selected = true; ph.hidden = true;
    ph.textContent = t('panel_placeholder_category');
    sel.appendChild(ph);

    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });

    if (prev && categories.includes(prev)) sel.value = prev;
  });
}

function buildCombinedObjectsForCategory(category) {
  const universeLibrary = getUniverseLibrary();

  const lang = getCurrentLang();
  const out = [];

  // офіційні
  universeLibrary.forEach(o => {
    if (o[`category_${lang}`] === category) {
      const name = o[`name_${lang}`];
      if (name) out.push({ name, source: 'official' });
    }
  });

  // користувацькі
  try {
    (getStore().list('diameter') || [])
      .filter(u => {
        const c =
          (typeof u.category === 'string' && u.category) ||
          (u.category_i18n && (u.category_i18n[lang] || u.category_i18n[u.originalLang]));
        return c === category;
      })
      .forEach(u => {
        const name =
          u.name ||
          u.name_i18n?.[lang] ||
          u.name_i18n?.[u.originalLang];
        if (name) out.push({ name, source: 'user' });
      });
  } catch {}

  out.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  return out;
}

function repopulateObjectsSelect(selectId, category, placeholderKey) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  // ⟵ NEW: якщо сектор заблокований — не чіпаємо його зовсім
  const group = sel.closest('.sector-block');
  if (group && group.classList.contains('is-locked')) return;

  // ⟵ NEW: запам’ятати попередній вибір
  const prev = sel.value;

  sel.innerHTML = '';

  const ph = document.createElement('option');
  ph.value = ''; ph.disabled = true; ph.selected = true; ph.hidden = true;
  ph.textContent = t(placeholderKey);
  sel.appendChild(ph);

  if (!category) return;

  const list = buildCombinedObjectsForCategory(category);
  list.forEach(it => {
    const opt = document.createElement('option');
    opt.value = it.name;
    opt.textContent = it.source === 'user' ? `${it.name} •` : it.name;
    sel.appendChild(opt);
  });

  // ⟵ NEW: якщо попереднє значення є в новому списку — відновити його
  if (prev) {
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === prev) { sel.value = prev; break; }
    }
  }
}


function rebuildForSlot(slot) {
  const objId = slot === 'object1' ? 'diamObject1' : 'diamObject2';
  const objSel = document.getElementById(objId);
  const group = objSel ? objSel.closest('.sector-block') : null;

  // ⟵ NEW: якщо сектор заблокований — нічого не робимо
  if (group && group.classList.contains('is-locked')) return;

  const catId = slot === 'object1' ? 'diamCategoryObject1' : 'diamCategoryObject2';
  const placeholderKey = slot === 'object1' ? 'panel_placeholder_object1' : 'panel_placeholder_object2';
  const cat = document.getElementById(catId)?.value || '';
  repopulateObjectsSelect(objId, cat, placeholderKey);
}


function rebuildObjectsForSelectedCategories() {
  rebuildForSlot('object1');
  rebuildForSlot('object2');
}





