// /js/userObjects/modal.js
'use strict';

import { t, getCurrentLang } from '../i18n.js';
import { loadBaseUnits, listUnits } from '../utils/unit_converter.js';
import { getStore } from './api.js';
import { getUserEmail } from '/cabinet/js/cloud/auth.cloud.js';
import { openCabinetSignInDialog } from '/cabinet/js/account.menu.js';

const ROOT_ID = 'modal-root';
let unitsLoaded = false;
// Marker "(корист.)" з i18n або дефолт
const USER_MARK = () => (t('ui.user_mark') || '(корист.)');

/* ───────────────────── Допоміжні ───────────────────── */

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

/* ───────────────── Категорії з режимних *_lib.js (єдине джерело) ─────────────────
   Мінімум: підтримуємо money. Інші режими додамо аналогічно. */

async function __loadLibCategories(mode) {
  if (!mode) return [];

  // ====== ВСЕСВІТ: distance | diameter | mass | luminosity ======
  if (mode === 'distance' || mode === 'diameter' || mode === 'mass' || mode === 'luminosity') {
    const lib = await import('../data/univers_lib.js');
    // очікується export async function listCategories(mode)
    return await lib.listCategories(mode);
  }

  // ====== ГЕОГРАФІЯ: geo_objects | geo_area | geo_population ======
  if (mode === 'geo_objects' || mode === 'geo_area' || mode === 'geo_population') {
    const lib = await import('../data/geo_lib.js');
    // очікується export async function listCategories(mode)
    return await lib.listCategories(mode);
  }

  // ====== МАТЕМАТИКА ======
  if (mode === 'math') {
    const lib = await import('../data/math_lib.js'); // абсолютний шлях, як у проекті
    // очікується export async function listCategories(mode='math')
    return await lib.listCategories('math');
  }

  // ====== ГРОШІ ======
  if (mode === 'money') {
    const lib = await import('../data/money_lib.js');
    // очікується export async function listCategories(mode='money')
    return await lib.listCategories('money');
  }

  // ====== ІСТОРІЯ ======
  if (mode === 'history') {
    const lib = await import('../data/history_lib.js');
    // історія повертає категорії без параметра
    return await lib.listCategories();
  }

  // інші режими поки не підключені
  return [];
}

function __formatCategoryLabel(item) {
  const mark = USER_MARK();
  const ua = item?.name_i18n?.ua?.trim() || '';
  const en = item?.name_i18n?.en?.trim() || '';
  const es = item?.name_i18n?.es?.trim() || '';
  const base = en || ua || es || String(item.key).replace(/[-_]+/g, ' ').trim();
  return item.isUser ? `${base} ${mark}` : base;
}

function __normalizeLabel(s) {
  return normalizeCategoryName(stripUserMark(s));
}

/* ───── Формування списку значень для <datalist> ТІЛЬКИ з *_lib.listCategories ───── */

async function buildCategoryListForDatalist(mode) {
  const items = await __loadLibCategories(mode);
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it || !it.key || seen.has(it.key)) continue;
    seen.add(it.key);
    out.push(__formatCategoryLabel(it));
  }
  return out;
}

// зворотна сумісність: тепер джерело — лише lib
async function getCategoriesFromSelects(mode) {
  return await buildCategoryListForDatalist(mode);
}

/** Обробка presetCategory: key → відображувана назва */
async function resolvePresetCategory(mode, presetCategory) {
  if (!presetCategory) return '';
  const items = await __loadLibCategories(mode);
  const hit = items.find(it => String(it.key) === String(presetCategory));
  return hit ? __formatCategoryLabel(hit) : presetCategory;
}

/**
 * Визначає остаточний ключ категорії для збереження:
 * - якщо введений текст відповідає існуючій категорії з lib → повертає її key;
 * - інакше генерує безпечний slug із введеної назви.
 */
async function resolveCategoryKey(mode, categoryName) {
  const clean = stripUserMark(categoryName);
  const normEntered = __normalizeLabel(clean);
  if (!normEntered) return 'category';

  const items = await __loadLibCategories(mode);

  // 1) Збіг із відображуваною міткою (як у datalist)
  for (const it of items) {
    const label = __formatCategoryLabel(it);
    if (__normalizeLabel(label) === normEntered) return it.key;
  }

  // 2) Збіг із будь-яким з name_i18n
  for (const it of items) {
    const ua = it?.name_i18n?.ua || '';
    const en = it?.name_i18n?.en || '';
    const es = it?.name_i18n?.es || '';
    if ([ua, en, es].some(n => __normalizeLabel(n) === normEntered)) return it.key;
  }

  // 3) Нова категорія → slug
  return slugifySafe(clean);
}

function processCategoryInput(categoryInput) {
  // Повертаємо чисту назву (без "(корист.)")
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

export async function openCreateModal({ mode, presetCategory = '', slot = 'object2' } = {}) {
  if (!mode) { console.error('[modal] mode is required'); return null; }
// Доступ лише для авторизованих
const email = await getUserEmail();
if (!email) {
  openCabinetSignInDialog();
  return null;
}

  await ensureUnitsLoaded();

  const root = document.getElementById(ROOT_ID);
  if (!root) {
    console.error('[modal] #modal-root not found');
    return null;
  }

  const lang = getCurrentLang();

  // ⚠️ Тепер категорії беремо ТІЛЬКИ з режимного lib
  const categories = await getCategoriesFromSelects(mode);

  // Правильно обробляємо presetCategory (це key)
  const presetCategoryName = await resolvePresetCategory(mode, presetCategory);

  const isHistory = mode === 'history';

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
              <span>${isHistory ? (t('field_value_start') || t('field_value')) : t('field_value')}</span>
              <input type="number" id="ouo-value" step="${isHistory ? '1' : 'any'}" ${isHistory ? '' : 'min="0"'} placeholder="${isHistory ? '0' : '0'}">
            </label>
            <label class="ouo-field">
              <span>${t('field_unit')}</span>
              <select id="ouo-unit"></select>
            </label>
          </div>

          ${isHistory ? `
          <!-- ТІЛЬКИ ДЛЯ ІСТОРІЇ: Кінець періоду (необов'язково) -->
          <div class="ouo-row">
            <label class="ouo-field">
              <span>${t('field_value_end_optional') || 'Кінець (необов’язково)'}</span>
              <input type="number" id="ouo-value2" step="1" placeholder="">
            </label>
            <label class="ouo-field">
              <span>${t('field_unit')}</span>
              <select id="ouo-unit2"></select>
            </label>
          </div>
          ` : ''}

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

    // Заповнити список одиниць згідно з mode (тільки з base_units)
    const units = listUnits(mode) || [];

    const unitSel = wrap.querySelector('#ouo-unit');
    units.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      unitSel.appendChild(opt);
    });
    if (units.length === 1) unitSel.disabled = true;

    if (isHistory) {
      const unitSel2 = wrap.querySelector('#ouo-unit2');
      units.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u;
        opt.textContent = u;
        unitSel2.appendChild(opt);
      });
      if (units.length === 1) unitSel2.disabled = true;
    }

    // Закриття модалки
    wrap.addEventListener('click', (e) => { if (e.target === wrap) { dispose(); resolve(null); } });
    wrap.querySelector('#ouo-cancel').addEventListener('click', () => { dispose(); resolve(null); });

    // Enter в полях — як клік "Створити"
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target;
        const inText = target && (
          target.id === 'ouo-name' ||
          target.id === 'ouo-value' ||
          target.id === 'ouo-value2' ||
          target.id === 'ouo-category'
        );
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

        const value2El = isHistory ? wrap.querySelector('#ouo-value2') : null;
        const value2Raw = isHistory ? value2El.value : null;
        const value2 = isHistory && value2Raw !== '' ? Number(value2Raw) : null;

        const unit2El = isHistory ? wrap.querySelector('#ouo-unit2') : null;
        const unit2 = isHistory ? unit2El.value : null;

        // Категорія: текст → офіційний key або новий slug (все через lib)
        const categoryName = processCategoryInput(categoryInput);
        const categoryKey  = await resolveCategoryKey(mode, categoryName);

        const invalid = [];
        if (!categoryName) invalid.push('category');
        if (!name) invalid.push('name');

        // ІСТОРІЯ: дозволяємо будь-яке скінченне число (може бути <0, 0)
        // Інші режими: >0
        const valueOk = isHistory ? Number.isFinite(value) : (value > 0);
        if (!valueOk) invalid.push('value');

        if (!unit) invalid.push('unit');

        // value2 (історія) — якщо введене, має бути скінченним
        if (isHistory && value2Raw !== '' && !Number.isFinite(value2)) {
          invalid.push('value2');
        }

        wrap.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        invalid.forEach(k => wrap.querySelector(`#ouo-${k}`)?.classList.add('is-invalid'));
        if (invalid.length) return;

        const payloadBase = {
          mode,
          [`name_${lang}`]: name,
          [`description_${lang}`]: desc || null,
          category_key: categoryKey,
          [`category_${lang}`]: categoryName,
          is_public: true,
          status: 'published'
        };

        // Формуємо значення/одиниці за режимом
        let payload;
        if (isHistory) {
          payload = {
            ...payloadBase,
            value: value,              // start (рік)
            value2: value2 ?? null,    // end (рік) опційно
            unit_key: unit,            // з listUnits(mode)
            unit2_key: (value2 != null) ? unit2 : null
          };
        } else {
          payload = {
            ...payloadBase,
            value: value,
            value2: null,
            unit_key: unit,
            unit2_key: null
          };
        }

        const store = getStore();
        const rec = await store.add(payload); // Supabase + оновлення кешів через події

        // Сигнали для UI
        const created = rec || payload;
        try {
          const detail = { mode, object: created, slot };
          document.dispatchEvent(new CustomEvent('user-objects-added',   { detail }));
          document.dispatchEvent(new CustomEvent('user-objects-changed', { detail }));
          document.dispatchEvent(new CustomEvent('user-objects-updated', { detail }));
          // Загальні/режимні сигнали для кешів
          if (mode === 'history') {
            document.dispatchEvent(new CustomEvent('history-lib-reloaded', { detail: { mode, reason: 'user-add', id: created.id } }));
          } else if (mode === 'geo_objects' || mode === 'geo_area' || mode === 'geo_population') {
            document.dispatchEvent(new CustomEvent('geo-lib-reloaded', { detail: { mode, reason: 'user-add', id: created.id } }));
          } else {
            document.dispatchEvent(new CustomEvent('univers-lib-reloaded', { detail: { mode, reason: 'user-add', id: created.id } }));
          }
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
