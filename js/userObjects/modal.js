// full/js/userObjects/modal.js
'use strict';

import { t, getCurrentLang } from '../i18n.js';
import { loadBaseUnits, listUnits } from '../utils/unit_converter.js';
import { getStore } from './api.js';

const ROOT_ID = 'modal-root';
let unitsLoaded = false;

/**
 * Збираємо підказки категорій:
 *  - з поточних селекторів категорій (обидва слоти)
 *  - з локальних користувацьких об'єктів (для поточної мови)
 */
function buildCategorySuggestions(mode) {
  const s = new Set();

  // з панелі (Діаметри)
  const ids = ['diamCategoryObject1', 'diamCategoryObject2'];
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    Array.from(sel.options).forEach(o => {
      const v = (o && o.value || '').trim();
      if (v) s.add(v);
    });
  });

  // з локального сховища
  try {
    const lang = getCurrentLang();
    (getStore().list(mode) || []).forEach(o => {
      // підтримка як старого формату (o.category: string), так і нового (o.category_i18n)
      const cat =
        (typeof o.category === 'string' && o.category) ||
        (o.category_i18n && (o.category_i18n[lang] || o.category_i18n[o.originalLang])) ||
        '';
      if (cat) s.add(cat);
    });
  } catch (_) {}

  return Array.from(s).sort((a, b) => a.localeCompare(b, 'uk'));
}

export async function openCreateModal({ mode = 'diameter', presetCategory = '', slot = 'object2' } = {}) {
  await ensureUnitsLoaded();

  const root = document.getElementById(ROOT_ID);
  if (!root) {
    console.error('[modal] #modal-root not found');
    return null;
  }

  const lang = getCurrentLang();
  const suggestions = buildCategorySuggestions(mode);

  return new Promise((resolve) => {
    const dispose = () => { root.innerHTML = ''; document.body.classList.remove('modal-open'); };
    document.body.classList.add('modal-open');

    const wrap = document.createElement('div');
    wrap.className = 'ouo-backdrop';
    wrap.innerHTML = `
      <div class="ouo-modal" role="dialog" aria-modal="true">
        <div class="ouo-modal__header">
          <h3>${t('create_modal_title_diameter')}</h3>
        </div>

        <div class="ouo-modal__body">
          <!-- Категорія: input + datalist -->
          <label class="ouo-field">
            <span>${t('field_category')}</span>
            <input type="text" id="ouo-category" list="ouo-cat-list"
                   placeholder="${t('panel_placeholder_category_choose_or_enter')}"
                   value="${escapeHtml(presetCategory)}">
            <datalist id="ouo-cat-list">
              ${suggestions.map(v => `<option value="${escapeHtml(v)}"></option>`).join('')}
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

          <!-- Фото (disabled) -->
          <label class="ouo-field ouo-field--disabled">
            <span>${t('field_image')}</span>
            <input type="file" disabled>
          </label>
        </div>

        <div class="ouo-modal__footer">
          <button id="ouo-cancel" class="btn-secondary">${t('btn_cancel')}</button>
          <button id="ouo-create" class="btn-primary">${t('btn_create')}</button>
        </div>
      </div>
    `;

    // підтягуємо одиниці для режиму
    const unitSel = wrap.querySelector('#ouo-unit');
    (listUnits(mode) || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      unitSel.appendChild(opt);
    });

    // Закриття по кліку на фон / Скасувати
    wrap.addEventListener('click', (e) => { if (e.target === wrap) { dispose(); resolve(null); } });
    wrap.querySelector('#ouo-cancel').addEventListener('click', () => { dispose(); resolve(null); });

    // Підтвердження "Створити"
    wrap.querySelector('#ouo-create').addEventListener('click', () => {
      const category = wrap.querySelector('#ouo-category').value.trim();
      const name = wrap.querySelector('#ouo-name').value.trim();
      const value = parseFloat(wrap.querySelector('#ouo-value').value);
      const unit = wrap.querySelector('#ouo-unit').value;
      const desc = wrap.querySelector('#ouo-desc').value.trim();

      const invalid = [];
      if (!category) invalid.push('category');
      if (!name) invalid.push('name');
      if (!(value > 0)) invalid.push('value');
      if (!unit) invalid.push('unit');

      // скидаємо підсвітку
      wrap.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
      invalid.forEach(k => wrap.querySelector(`#ouo-${k}`).classList.add('is-invalid'));
      if (invalid.length) return;

      // Формуємо запис: одночасно зберігаємо плоскі поля (name, category) для сумісності
      // і i18n-поля (name_i18n, category_i18n, description_i18n) + originalLang.
      const payload = {
        mode,
        originalLang: lang,
        // плоскі поля (для сумісності з існуючими місцями використання)
        name,
        category,
        // i18n-поля для розширення надалі
        name_i18n: { [lang]: name },
        category_i18n: { [lang]: category },
        description_i18n: desc ? { [lang]: desc } : {},
        // атрибути об'єкта (відразу закладаємо всі 4 типи, інші — null)
        attrs: {
          diameter:   { value, unit },
          mass:       null,
          luminosity: null,
          distance:   null
        },
        imageUrl: null
      };

      const store = getStore();
      const rec = store.add(payload);

      dispose();
      resolve({ object: rec, slot });

      // Сповіщаємо систему
      document.dispatchEvent(new CustomEvent('user-objects-added', {
        detail: { mode, object: rec, slot }
      }));
    });

    root.innerHTML = '';
    root.appendChild(wrap);
  });
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function ensureUnitsLoaded() {
  if (unitsLoaded) return;
  try { await loadBaseUnits(); } finally { unitsLoaded = true; }
}

