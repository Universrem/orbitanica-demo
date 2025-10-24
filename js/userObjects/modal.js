// /js/userObjects/modal.js
'use strict';

import { t, getCurrentLang } from '../i18n.js';
import { loadBaseUnits, listUnits } from '../utils/unit_converter.js';
import { getStore } from './api.js';

const ROOT_ID = 'modal-root';
let unitsLoaded = false;
// Marker "(корист.)" з i18n або дефолт
const USER_MARK = () => (t('ui.user_mark') || '(корист.)');

// Нормалізація тексту категорії для порівнянь (прибирає суфікс, трім, нижній регістр)
function normalizeCategoryName(s) {
  return String(s || '')
    .replace(/\s*\((?:корист\.|user)\)\s*$/i, '')
    .trim()
    .toLowerCase();
}

// Повертає назву без суфіксу "(корист.)"
function stripUserMark(s) {
  return String(s || '').replace(/\s*\((?:корист\.|user)\)\s*$/i, '').trim();
}

// Юнікод-френдлі slugify: не «вбиває» кирилицю
function slugifySafe(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s._/-]/gu, '')
    .replace(/[\s._/]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function slugify(s) {
  return slugifySafe(s) || 'category';
}

/**
 * Єдиний каталог категорій для модалки:
 * - officialNamesLC: Set нормалізованих офіційних назв
 * - officialByName: Map нормалізована назва -> офіційний ключ
 * - userNamesLC: Set нормалізованих користувацьких назв
 *
 * ОФІЦІЙНІ: беремо з наявних селектів (тільки як джерело назв),
 *           ключ (id) пробуємо отримати з window.ORB_CATEGORIES[mode]?.nameToKey (якщо проєкт це надає).
 * КОРИСТУВАЦЬКІ: беремо з локального стора (getStore()).
 */
function buildCategoryCatalog(mode) {
  const officialNamesLC = new Set();
  const officialByName = new Map();
  const userNamesLC = new Set();

  // 1) Офіційні (назви) — з видимих селекторів
  const categorySelectIds = [
    'diamCategoryObject1', 'diamCategoryObject2',
    'distCategoryObject2', 'lumCategoryObject2',
    'massCategoryObject2'
  ];
  const nameToKeyHook = (window.ORB_CATEGORIES && window.ORB_CATEGORIES[mode] && window.ORB_CATEGORIES[mode].nameToKey) || null;

  categorySelectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    Array.from(sel.options).forEach(opt => {
      const raw = (opt.textContent || '').trim();
      if (opt.disabled || opt.hidden) return;
      const clean = stripUserMark(raw);
      const norm = normalizeCategoryName(clean);
      if (!norm) return;
      // ігноруємо плейсхолдери
      const ph = t('panel_placeholder_category');
      if (ph && norm === normalizeCategoryName(ph)) return;

      officialNamesLC.add(norm);
      if (nameToKeyHook && !officialByName.has(norm)) {
        const key = nameToKeyHook[clean] || nameToKeyHook[clean.toLowerCase()] || null;
        if (key) officialByName.set(norm, key);
      }
    });
  });

  // 2) Користувацькі (назви) — з локального стора
  try {
    const store = getStore();
    const list = store.list(mode) || [];
    const lang = getCurrentLang();
    list.forEach(o => {
      const nm = (typeof o[`category_${lang}`] === 'string' && o[`category_${lang}`]) ||
                 (typeof o.category === 'string' && o.category) || '';
      if (!nm) return;
      const clean = stripUserMark(nm);
      const norm = normalizeCategoryName(clean);
      if (norm) userNamesLC.add(norm);
    });
  } catch (_) {}

  return { officialNamesLC, officialByName, userNamesLC };
}

/**
 * Формування списку значень для <datalist>:
 * - офіційні назви (раз, без "(корист.)")
 * - користувацькі, які не збігаються з офіційними (з "(корист.)")
 */
function buildCategoryListForDatalist(mode) {
  const { officialNamesLC, userNamesLC } = buildCategoryCatalog(mode);
  const result = new Set();

  // офіційні назви (як з’являються у селекторах) — беремо напряму з селекторів
  const categorySelectIds = [
    'diamCategoryObject1', 'diamCategoryObject2',
    'distCategoryObject2', 'lumCategoryObject2',
    'massCategoryObject2'
  ];
  categorySelectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    Array.from(sel.options).forEach(opt => {
      const raw = (opt.textContent || '').trim();
      if (!opt.value || opt.disabled || opt.hidden) return;
      const ph = t('panel_placeholder_category');
      if (ph && normalizeCategoryName(stripUserMark(raw)) === normalizeCategoryName(ph)) return;

      if (!raw) return;
      const clean = stripUserMark(raw);
      const norm = normalizeCategoryName(clean);
      if (!norm) return;
      // офіційні — без мітки
      result.add(clean);
    });
  });

  // користувацькі, що не дублюють офіційні — додаємо з міткою
  const userMark = USER_MARK();
  userNamesLC.forEach(norm => {
    if (!officialNamesLC.has(norm)) {
      // знайдемо «красивий» лейбл у сторі
      try {
        const store = getStore();
        const list = store.list(mode) || [];
        const lang = getCurrentLang();
        const hit = list.find(o => {
          const nm = (o.category_i18n && o.category_i18n[lang]) || o[`category_${lang}`] || o.category || '';
          return normalizeCategoryName(stripUserMark(nm)) === norm;
        });
        const pretty = hit ? stripUserMark((hit.category_i18n && hit.category_i18n[lang]) || hit[`category_${lang}`] || hit.category || '') : norm;
        result.add(`${pretty} ${userMark}`);
      } catch (_) {}
    }
  });

  return Array.from(result).sort((a, b) => a.localeCompare(b, 'uk'));
}

/**
 * Визначає остаточний ключ категорії для збереження:
 * - якщо назва відповідає офіційній (за нормалізацією) і відомий її ключ — повертає офіційний ключ;
 * - інакше генерує безпечний slug.
 */
function resolveCategoryKey(mode, categoryName) {
  const clean = stripUserMark(categoryName);
  const norm = normalizeCategoryName(clean);
  if (!norm) return 'category';

  const { officialByName } = buildCategoryCatalog(mode);
  const key = officialByName.get(norm);
  if (key) return key;

  return slugifySafe(clean);
}

/** Обробка presetCategory - перетворення ключа в назву */
async function resolvePresetCategory(mode, presetCategory) {
  if (!presetCategory) return '';

  const allCategories = getCategoriesFromSelects(mode);
  for (const category of allCategories) {
    const cleanCategory = category.replace(/ \(корист\.\)$/, '').replace(/ \(user\)$/, '');
    if (cleanCategory === presetCategory ||
        category.includes(presetCategory) ||
        slugify(cleanCategory) === presetCategory) {
      return category;
    }
  }
  return presetCategory;
}

function processCategoryInput(categoryInput) {
  // Повертаємо чисту назву (без "(корист.)"), а не структуру з прапорцями
  return stripUserMark(categoryInput || '');
}

function resolveCreateTitle(mode) {
  const MAP = {
    diameter:       ['panel_title_univers', 'panel_title_univers_diameter'],
    distance:       ['panel_title_univers', 'panel_title_univers_distance'],
    luminosity:     ['panel_title_univers', 'panel_title_univers_luminosity'],
    mass:           ['panel_title_univers', 'panel_title_univers_mass'],
    geo_objects:    ['panel_title_geo',     'panel_title_geo_objects'],
    geo_area:       ['panel_title_geo',     'panel_title_geo_area'],
    geo_population: ['panel_title_geo',     'panel_title_geo_population'],
    money:          ['panel_title_money'],
    math:           ['panel_title_math'],
    history:        ['panel_title_history']
  };

  const pair = MAP[mode];
  if (!pair) return t('ui.create_object') || 'New Object';
  return pair.length === 1 ? t(pair[0]) : `${t(pair[0])}: ${t(pair[1])}`;
}

function getCategoriesFromSelects(mode) {
  // зворотна сумісність: ця функція тепер повертає ГОТОВИЙ список для datalist
  return buildCategoryListForDatalist(mode);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

async function ensureUnitsLoaded() {
  if (unitsLoaded) return;
  try {
    await loadBaseUnits();
  } finally {
    unitsLoaded = true;
  }
}

/* ───────────────────────────── ПУБЛІЧНИЙ API ───────────────────────────── */

export async function openCreateModal({ mode = 'diameter', presetCategory = '', slot = 'object2' } = {}) {
  await ensureUnitsLoaded();

  const root = document.getElementById(ROOT_ID);
  if (!root) {
    console.error('[modal] #modal-root not found');
    return null;
  }

  const lang = getCurrentLang();
  const categories = getCategoriesFromSelects(mode);

  // Правильно обробляємо presetCategory
  const presetCategoryName = await resolvePresetCategory(mode, presetCategory);

  return new Promise(async (resolve) => {
    const dispose = () => { root.innerHTML = ''; document.body.classList.remove('modal-open'); };
    document.body.classList.add('modal-open');

    const wrap = document.createElement('div');
    wrap.className = 'ouo-backdrop';
    wrap.innerHTML = `
      <div class="ouo-modal" role="dialog" aria-modal="true">
        <div class="ouo-modal__header">
          <h3>${resolveCreateTitle(mode)}</h3>
        </div>

        <div class="ouo-modal__body">
          <!-- Категорія: input + datalist -->
          <label class="ouo-field">
            <span>${t('field_category')}</span>
            <input type="text" id="ouo-category" list="ouo-cat-list"
                   placeholder="${t('panel_placeholder_category_choose_or_enter')}"
                   value="${escapeHtml(presetCategoryName)}">
            <datalist id="ouo-cat-list">
              ${categories.map(v => `<option value="${escapeHtml(v)}"></option>`).join('')}
            </datalist>
          </label>

          <!-- Назва: текстове поле -->
          <label class="ouo-field">
            <span>${t('field_name')}</span>
            <input type="text" id="ouo-name" placeholder="${t('panel_placeholder_enter_object_name')}">
          </label>

          <!-- Значення + одиниця -->
          <div class="ouo-row">
            <label class="ouo-field">
              <span>${t('field_value')}</span>
              <input type="number" id="ouo-value" step="any" min="0" placeholder="0">
            </label>
            <label class="ouo-field">
              <span>${t('field_unit')}</span>
              <select id="ouo-unit"></select>
            </label>
          </div>

          <!-- Опис (опційно) -->
          <label class="ouo-field">
            <span>${t('field_description')}</span>
            <textarea id="ouo-desc" rows="3" placeholder=""></textarea>
          </label>
        </div>

        <div class="ouo-modal__footer">
          <button id="ouo-cancel" class="btn-secondary">${t('btn_cancel')}</button>
          <button id="ouo-create" class="btn-primary">${t('btn_create')}</button>
        </div>
      </div>
    `;

    await ensureUnitsLoaded();

    // Заповнити список одиниць згідно з mode
    const unitSel = wrap.querySelector('#ouo-unit');
    (listUnits(mode) || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      unitSel.appendChild(opt);
    });

    // Закриття модалки
    wrap.addEventListener('click', (e) => { if (e.target === wrap) { dispose(); resolve(null); } });
    wrap.querySelector('#ouo-cancel').addEventListener('click', () => { dispose(); resolve(null); });

    // Enter в полях — як клік "Створити"
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target;
        const inText = target && (target.id === 'ouo-name' || target.id === 'ouo-value' || target.id === 'ouo-category');
        if (inText) {
          e.preventDefault();
          wrap.querySelector('#ouo-create')?.click();
        }
      }
    });

    // Захист від подвійного сабміту
    let submitting = false;

    wrap.querySelector('#ouo-create').addEventListener('click', async () => {
      if (submitting) return;
      submitting = true;

      const btn = wrap.querySelector('#ouo-create');
      btn.disabled = true;

      try {
        const categoryInput = wrap.querySelector('#ouo-category').value.trim();
        const name = wrap.querySelector('#ouo-name').value.trim();
        const valueNum = wrap.querySelector('#ouo-value').value;
        const value = Number(valueNum);
        const unit = wrap.querySelector('#ouo-unit').value;
        const desc = wrap.querySelector('#ouo-desc').value.trim();

        // Обробляємо категорію
        const categoryName = processCategoryInput(categoryInput);
        const categoryKey  = resolveCategoryKey(mode, categoryName);

        const invalid = [];
        if (!categoryName) invalid.push('category');
        if (!name) invalid.push('name');
        if (!(value > 0)) invalid.push('value');
        if (!unit) invalid.push('unit');

        wrap.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        invalid.forEach(k => wrap.querySelector(`#ouo-${k}`).classList.add('is-invalid'));
        if (invalid.length) return;

        const payload = {
          mode,
          [`name_${lang}`]: name,
          [`description_${lang}`]: desc || null,
          category_key: categoryKey,
          [`category_${lang}`]: categoryName,
          value: value,
          value2: null,
          unit_key: unit,
          unit2_key: null,
          is_public: true,
          status: 'published'
        };

        const store = getStore();
        const rec = await store.add(payload); // тригери + оновлення univers_lib усередині

        // Сигнали для UI (вузький і широкий канали)
        const created = rec || payload;
        try {
          const detail = { mode, object: created, slot };
          // вузькі події (щоб блоки одразу підкинули в селектор)
          document.dispatchEvent(new CustomEvent('user-objects-added', { detail }));
          document.dispatchEvent(new CustomEvent('user-objects-changed', { detail }));
          // універсальна для бібліотеки
          document.dispatchEvent(new CustomEvent('user-objects-updated', { detail }));
          // допоміжний сигнал для всіх, хто слухає кеш бібліотеки
          document.dispatchEvent(new CustomEvent('univers-lib-reloaded', { detail: { mode, reason: 'user-add', id: created.id } }));
        } catch {}

        dispose();
        resolve({ object: created, slot });
      } catch (err) {
        console.error('[modal] create failed', err);
        // залишаємо модалку відкритою для виправлення
      } finally {
        submitting = false;
        btn.disabled = false;
      }
    });

    const rootMount = document.getElementById(ROOT_ID);
    rootMount.innerHTML = '';
    rootMount.appendChild(wrap);
    wrap.querySelector('#ouo-name').focus();
  });
}
