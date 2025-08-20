// full/js/blocks/univers_distance.js
'use strict';

import { getCurrentLang, t } from '../i18n.js';
import { getStore } from '../userObjects/api.js';
import { getUniverseLibrary } from '../data/universe.js';

let universeLibrary = [];

// Дозволені еталони для О1 (тільки вони з’являються у списку)
const O1_NAMES = {
  ua: ['Земля', 'Сонце'],
  en: ['Earth', 'Sun'],
  es: ['Tierra', 'Sol']
};
// Бажаний порядок у списку О1 (якщо знайдені обидва)
const O1_ORDER = {
  ua: ['Земля', 'Сонце'],
  en: ['Earth', 'Sun'],
  es: ['Tierra', 'Sol']
};

/** Головна ініціалізація блоку "Відстань" */
export async function initUniversDistanceBlock() {
  // 1) О1 без категорій: просто заповнити короткий список еталонів
  populateObject1Select();

  // 2) О2: категорії лише там, де є distance_to_earth (офіційні/юзерські)
  updateCategoriesObject2();

  // 3) Прив’язка onChange категорії О2 → оновити об’єкти О2
  const cat2 = document.getElementById('distCategoryObject2');
  cat2?.addEventListener('change', () => rebuildObject2List());

  // 4) Первинне наповнення списку О2 за поточною категорією
  rebuildObject2List();

  // 5) Реакція на створення/зміну юзер-об’єктів у режимі "distance" (для О2)
  document.addEventListener('user-objects-added', (e) => {
    const d = e.detail || {};
    if (d.mode !== 'distance' || !d.object) return;
    updateCategoriesObject2();
    rebuildObject2List();
  });
  document.addEventListener('user-objects-changed', () => {
    updateCategoriesObject2();
    rebuildObject2List();
  });

  // 6) Після "Скинути" в межах блоку "Відстань" — оновити списки
  document.addEventListener('click', (e) => {
    const btn = e.target;
    if (!(btn instanceof HTMLElement)) return;
    if (btn.id !== 'reset') return;
    const block = btn.closest('#univers_distance');
    if (!block) return;
    setTimeout(() => {
      populateObject1Select();
      updateCategoriesObject2();
      rebuildObject2List();
    }, 0);
  });

  // 7) Зміна мови: перебудувати все (без повторного завантаження бібліотеки)
  document.addEventListener('languageChanged', async () => {
    populateObject1Select();
    updateCategoriesObject2();
    rebuildObject2List();
  });
}

// ─────────────────────────────────────────────
// Слот О1 (без категорій)

function populateObject1Select() {
  const lang = getCurrentLang();
  const sel = document.getElementById('distObject1');
  if (!sel) return;

  // якщо сектор заблокований — не чіпаємо
  const group = sel.closest('.sector-block');
  if (group && group.classList.contains('is-locked')) return;

  const prev = sel.value;
  sel.innerHTML = '';

  // плейсхолдер
  const ph = document.createElement('option');
  ph.value = ''; ph.disabled = true; ph.selected = true; ph.hidden = true;
  ph.textContent = t('panel_placeholder_object1');
  sel.appendChild(ph);

  // шукаємо в бібліотеці лише дозволені назви (для поточної мови)
  const allowed = new Set(O1_NAMES[lang] || O1_NAMES.ua);
  const order = O1_ORDER[lang] || O1_ORDER.ua;

  // зібрати унікальні імена, що є у бібліотеці
  universeLibrary = getUniverseLibrary() || [];
  const found = new Set();
  universeLibrary.forEach(o => {
    const name = o[`name_${lang}`];
    if (name && allowed.has(name)) found.add(name);
  });

  // впорядкувати згідно бажаного порядку; решту (якщо будуть) — алфавітом
  const list = [];
  order.forEach(n => { if (found.has(n)) list.push(n); });
  const rest = [...found].filter(n => !order.includes(n)).sort((a, b) => a.localeCompare(b, 'uk'));
  list.push(...rest);

  // наповнити селект
  list.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });

  // відновити попередній вибір, якщо можливий
  if (prev) {
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === prev) { sel.value = prev; break; }
    }
  }
}

// ─────────────────────────────────────────────
// Слот О2 (з категоріями, але лише з distance_to_earth)

function updateCategoriesObject2() {
  const lang = getCurrentLang();
  universeLibrary = getUniverseLibrary() || [];
  const set = new Set();

  // офіційні
  universeLibrary.forEach(o => {
    const cat = o[`category_${lang}`];
    const hasDist = Number.isFinite(o?.distance_to_earth?.value);
    if (cat && hasDist) set.add(cat);
  });

  // користувацькі
  try {
    (getStore().list('distance') || []).forEach(u => {
      const cat =
        u.category ||
        u.category_i18n?.[lang] ||
        u.category_i18n?.[u.originalLang];

      const distVal =
        u?.attrs?.distance_to_earth?.value ??
        u?.attrs?.distance?.value;

      if (cat && Number.isFinite(distVal)) set.add(cat);
    });
  } catch {}

  const categories = Array.from(set).sort();
  repopulateCategorySelect('distCategoryObject2', categories);
}

function repopulateCategorySelect(selectId, categories) {
  const sel = document.getElementById(selectId);
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
}

function rebuildObject2List() {
  const objSel = document.getElementById('distObject2');
  if (!objSel) return;

  // заблокований сектор — не чіпаємо
  const group = objSel.closest('.sector-block');
  if (group && group.classList.contains('is-locked')) return;

  const catSel = document.getElementById('distCategoryObject2');
  const category = catSel?.value || '';

  repopulateObjectsO2('distObject2', category, 'panel_placeholder_object2');
}

function repopulateObjectsO2(selectId, category, placeholderKey) {
  const lang = getCurrentLang();
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const prev = sel.value;
  sel.innerHTML = '';

  // плейсхолдер
  const ph = document.createElement('option');
  ph.value = ''; ph.disabled = true; ph.selected = true; ph.hidden = true;
  ph.textContent = t(placeholderKey);
  sel.appendChild(ph);

  if (!category) return;
  universeLibrary = getUniverseLibrary() || [];
  const out = [];

  // офіційні
  universeLibrary.forEach(o => {
    if (o[`category_${lang}`] !== category) return;
    const name = o[`name_${lang}`];
    const hasDist = Number.isFinite(o?.distance_to_earth?.value);
    if (name && hasDist) out.push({ name, source: 'official' });
  });

  // користувацькі
  try {
    (getStore().list('distance') || [])
      .filter(u => {
        const c =
          u.category ||
          u.category_i18n?.[lang] ||
          u.category_i18n?.[u.originalLang];
        return c === category;
      })
      .forEach(u => {
        const name =
          u.name ||
          u.name_i18n?.[lang] ||
          u.name_i18n?.[u.originalLang];

        const distVal =
          u?.attrs?.distance_to_earth?.value ??
          u?.attrs?.distance?.value;

        if (name && Number.isFinite(distVal)) {
          out.push({ name, source: 'user' });
        }
      });
  } catch {}

  out.sort((a, b) => a.name.localeCompare(b.name, 'uk'));

  out.forEach(it => {
    const opt = document.createElement('option');
    opt.value = it.name;
    opt.textContent = it.source === 'user' ? `${it.name} •` : it.name;
    sel.appendChild(opt);
  });

  // відновити попередній вибір, якщо можливий
  if (prev) {
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === prev) { sel.value = prev; break; }
    }
  }
}
