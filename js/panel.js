// js/panel.js

'use strict';

import { resetAllUI } from './events/reset.js';
import { getMode } from './modes/registry.js';
import './modes/builtin.js'; // реєструє стандартні режими (side-effect)

// Іконка потрібна лише для create
function getIconForAction(action) {
  if (action === 'create') return '/res/icons/add.png';
  return '';
}

/** Фабрика елементів полів лівої панелі */
function createField(f) {
  let el;

  if (f.type === 'select') {
    el = document.createElement('select');
    el.id = f.id;
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = f.placeholder;
    opt.disabled = true;
    opt.selected = true;
    el.append(opt);
    el.classList.add('has-placeholder');

  } else if (f.type === 'input') {
    el = document.createElement('input');
    el.type = 'number';
    el.inputMode = 'decimal';
    el.step = 'any';
    el.id = f.id;
    el.placeholder = f.placeholder;

  } else if (f.type === 'button') {
    const isCalc = f.id === 'calculate';
    const isReset = f.id === 'reset';
    const isCreate = f.id === 'create';

    if (isCalc || isReset) {
      // ТЕКСТОВІ кнопки для Start/Reset (без іконок і тултіпів)
      el = document.createElement('button');
      el.id = f.id;
      el.dataset.action = f.id;

      el.classList.add('panel-btn');
      if (isCalc) el.classList.add('panel-btn--primary');
      if (isReset) el.classList.add('panel-btn--outline');

      const label = String(f.text || '').trim();
      if (label) {
        el.textContent = label;
        el.setAttribute('aria-label', label);
      }
      el.removeAttribute('title');

    } else if (isCreate) {
      // МАЛЕНЬКА ІКОНКА create — як було
      el = document.createElement('button');
      el.id = f.id;
      el.dataset.action = f.id;

      el.className = 'icon-button';
      const label = String(f.text || '').trim();
      if (label) el.setAttribute('aria-label', label);

      const img = document.createElement('img');
      img.className = 'btn-icon';
      img.src = getIconForAction('create');
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      el.append(img);
      el.removeAttribute('title');

    } else {
      // Дефолт: текстова
      el = document.createElement('button');
      el.id = f.id;
      el.dataset.action = f.id;
      el.classList.add('panel-btn', 'panel-btn--secondary');
      const label = String(f.text || '').trim();
      if (label) {
        el.textContent = label;
        el.setAttribute('aria-label', label);
      }
      el.removeAttribute('title');
    }

  } else if (f.type === 'text') {
    el = document.createElement('div');
    el.id = f.id;
    el.textContent = f.text;
    (f.className ? el.className = f.className : el.classList.add('panel-note'));
    if (f.i18nKey) el.setAttribute('data-i18n-key', f.i18nKey);

  } else if (f.type === 'group') {
    el = document.createElement('div');
    el.className = f.className || 'sector-block';
    f.children.forEach(child => {
      const childEl = createField(child);
      el.appendChild(childEl);
    });

  } else if (f.type === 'separator') {
    el = document.createElement('hr');
  }

  return el;
}

/**
 * Ініціалізація лівої панелі.
 * ВАЖЛИВО: сюди передаємо функцію перекладу `t` з i18n.
 */
export function initLeftPanel(t) {
  console.log('🔧 initLeftPanel запущено');
  const ALWAYS_OPEN_SECTIONS = new Set();

  const panelConfig = [

    { type: 'note', i18nKey: 'panel_note_scenes', text: t('panel_note_scenes'), className: 'panel-section-title' },

    { id: 'scene_day', title: t('panel_title_scene_day') },
    { id: 'interesting', title: t('panel_title_interesting') },
    { id: 'all_scenes', title: t('panel_title_all_scenes') },

    { type: 'note', i18nKey: 'panel_note_create_scenes', text: t('panel_note_create_scenes'), className: 'panel-section-title' },

    {
      id: 'univers',
      title: t('panel_title_univers'),
      children: [
        {
          id: 'univers_diameter', title: t('panel_title_univers_diameter'),
          fields: [
            {
              type: 'group', className: 'sector-block object1-group', children: [
                { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
                { type: 'select', id: 'diamCategoryObject1', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'diamObject1',         placeholder: t('panel_placeholder_object1') },
                { type: 'input',  id: 'diamCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block object2-group', children: [
                { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
                { type: 'select', id: 'diamCategoryObject2', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'diamObject2',         placeholder: t('panel_placeholder_object2') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'button', id: 'calculate', text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',     text: t('panel_button_reset') }
              ]
            }
          ]
        },
        {
          id: 'univers_distance', title: t('panel_title_univers_distance'),
          fields: [
            {
              type: 'group', className: 'sector-block object1-group', children: [
                { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
                { type: 'select', id: 'distObject1',         placeholder: t('panel_placeholder_object1') },
                { type: 'input',  id: 'distCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
              ]
            },
            {
              type: 'group', className: 'sector-block object2-group', children: [
                { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
                { type: 'select', id: 'distCategoryObject2', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'distObject2',         placeholder: t('panel_placeholder_object2') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'button', id: 'calculate', text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',     text: t('panel_button_reset') }
              ]
            }
          ]
        },
        {
          id: 'univers_luminosity', title: t('panel_title_univers_luminosity'),
          fields: [
            {
              type: 'group', className: 'sector-block object1-group', children: [
                { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
                { type: 'select', id: 'lumiCategoryObject1', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'lumiObject1',         placeholder: t('panel_placeholder_object1') },
                { type: 'input',  id: 'lumiCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block object2-group', children: [
                { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
                { type: 'select', id: 'lumiCategoryObject2', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'lumiObject2',         placeholder: t('panel_placeholder_object2') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'button', id: 'calculate', text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',     text: t('panel_button_reset') }
              ]
            }
          ]
        },
        {
          id: 'univers_mass', title: t('panel_title_univers_mass'),
          fields: [
            {
              type: 'group', className: 'sector-block object1-group', children: [
                { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
                { type: 'select', id: 'massCategoryObject1', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'massObject1',         placeholder: t('panel_placeholder_object1') },
                { type: 'input',  id: 'massCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block object2-group', children: [
                { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
                { type: 'select', id: 'massCategoryObject2', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'massObject2',         placeholder: t('panel_placeholder_object2') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'button', id: 'calculate', text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',     text: t('panel_button_reset') }
              ]
            }
          ]
        }
      ]
    },

    {
      id: 'history', title: t('panel_title_history'),
      fields: [
        {
          type: 'group', className: 'sector-block object1-group', children: [
            { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
            { type: 'select', id: 'histCategoryObject1', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'histObject1',         placeholder: t('panel_placeholder_event1') },
            { type: 'input',  id: 'historyBaselineDiameter', placeholder: t('panel_placeholder_input_diameter') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block object2-group', children: [
            { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
            { type: 'select', id: 'histCategoryObject2', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'histObject2',         placeholder: t('panel_placeholder_event2') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'button', id: 'calculate', text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',     text: t('panel_button_reset') }
          ]
        }
      ]
    },

    {
      id: 'geo', title: t('panel_title_geo'),
      children: [
        {
          id: 'geo_population', title: t('panel_title_geo_population'),
          fields: [
            {
              type: 'group', className: 'sector-block object1-group', children: [
                { type: 'text',   id: 'selectFirstObject',       text: t('note_select_first_object') },
                { type: 'select', id: 'geoPopCategoryObject1',    placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'geoPopObject1',            placeholder: t('panel_placeholder_object1') },
                { type: 'input',  id: 'geoPopBaselineDiameter',   placeholder: t('panel_placeholder_input_diameter') },
                { type: 'button', id: 'create',                   text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block object2-group', children: [
                { type: 'text',   id: 'selectSecondObject',    text: t('note_select_second_object') },
                { type: 'select', id: 'geoPopCategoryObject2', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'geoPopObject2',         placeholder: t('panel_placeholder_object2') },
                { type: 'button', id: 'create',                text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'button', id: 'calculate', text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',     text: t('panel_button_reset') }
              ]
            }
          ]
        },
        {
          id: 'geo_area', title: t('panel_title_geo_area'),
          fields: [
            {
              type: 'group', className: 'sector-block object1-group', children: [
                { type: 'text',   id: 'selectFirstObject',       text: t('note_select_first_object') },
                { type: 'select', id: 'geoAreaCategoryObject1',   placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'geoAreaObject1',           placeholder: t('panel_placeholder_object1') },
                { type: 'input',  id: 'geoAreaBaselineDiameter',  placeholder: t('panel_placeholder_input_diameter') },
                { type: 'button', id: 'create',                   text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block object2-group', children: [
                { type: 'text',   id: 'selectSecondObject',     text: t('note_select_second_object') },
                { type: 'select', id: 'geoAreaCategoryObject2',  placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'geoAreaObject2',          placeholder: t('panel_placeholder_object2') },
                { type: 'button', id: 'create',                  text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'button', id: 'calculate', text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',     text: t('panel_button_reset') }
              ]
            }
          ]
        },
        {
          id: 'geo_objects', title: t('panel_title_geo_objects'),
          fields: [
            {
              type: 'group', className: 'sector-block object1-group', children: [
                { type: 'text',   id: 'selectFirstObject',       text: t('note_select_first_object') },
                { type: 'select', id: 'geoObjCategoryObject1',    placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'geoObjObject1',            placeholder: t('panel_placeholder_object1') },
                { type: 'input',  id: 'geoObjBaselineDiameter',   placeholder: t('panel_placeholder_input_diameter') },
                { type: 'button', id: 'create',                   text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block object2-group', children: [
                { type: 'text',   id: 'selectSecondObject',    text: t('note_select_second_object') },
                { type: 'select', id: 'geoObjCategoryObject2',  placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'geoObjObject2',          placeholder: t('panel_placeholder_object2') },
                { type: 'button', id: 'create',                 text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'button', id: 'calculate', text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',     text: t('panel_button_reset') }
              ]
            }
          ]
        }
      ]
    },

    {
      id: 'money', title: t('panel_title_money'),
      fields: [
        {
          type: 'group', className: 'sector-block object1-group', children: [
            { type: 'text',   id: 'selectFirstObject',       text: t('note_select_first_object') },
            { type: 'select', id: 'moneyCategoryObject1', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'moneyObject1',         placeholder: t('panel_placeholder_object1') },
            { type: 'input',  id: 'moneyBaselineDiameter',   placeholder: t('panel_placeholder_input_diameter') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block object2-group', children: [
            { type: 'text',   id: 'selectSecondObject',    text: t('note_select_second_object') },
            { type: 'select', id: 'moneyCategoryObject2', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'moneyObject2',         placeholder: t('panel_placeholder_object2') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'button', id: 'calculate', text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',     text: t('panel_button_reset') },
          ]
        }
      ]
    },

    {
      id: 'math', title: t('panel_title_math'),
      fields: [
        {
          type: 'group', className: 'sector-block object1-group', children: [
            { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
            { type: 'select', id: 'mathCategoryObject1', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'mathObject1',         placeholder: t('panel_placeholder_object1') },
            { type: 'input',  id: 'mathBaselineDiameter',   placeholder: t('panel_placeholder_input_diameter') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block object2-group', children: [
            { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
            { type: 'select', id: 'mathCategoryObject2', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'mathObject2',         placeholder: t('panel_placeholder_object2') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'button', id: 'calculate', text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',     text: t('panel_button_reset') }
          ]
        }
      ]
    },

    { type: 'note', i18nKey: 'panel_title_options', text: t('panel_title_options'), className: 'panel-section-title' },

    { id: 'settings', title: t('panel_title_settings') },

    { id: 'faq', title: t('panel_title_faq') },

  ];

  // ==== Reactivity на зміну мови
  const onLangChanged = () => {
    // Заголовки секцій
    document.querySelectorAll('#left-panel > details > summary').forEach(summary => {
      const id = summary.parentElement.id;
      const key = 'panel_title_' + id;
      summary.textContent = t(key);
    });

    // Заголовки підсекцій
    document.querySelectorAll('#left-panel details > .section-content > details > summary').forEach(summary => {
      const id = summary.parentElement.id;
      const key = 'panel_title_' + id;
      summary.textContent = t(key);
    });

    // Поля
    document.querySelectorAll('#left-panel select, #left-panel input, #left-panel button, #left-panel .panel-note, #left-panel .panel-section-title').forEach(el => {
      const id = el.id;

      if (el.tagName === 'SELECT') {
        const opt = el.querySelector('option');
        if (opt) {
          if (id.includes('Category')) {
            opt.textContent = t('panel_placeholder_category');
          } else if (id?.startsWith('hist') && id?.endsWith('Object1')) {
            opt.textContent = t('panel_placeholder_event1');
          } else if (id?.startsWith('hist') && id?.endsWith('Object2')) {
            opt.textContent = t('panel_placeholder_event2');
          } else if (id?.endsWith('Object1')) {
            opt.textContent = t('panel_placeholder_object1');
          } else if (id?.endsWith('Object2')) {
            opt.textContent = t('panel_placeholder_object2');
          }
        }

      } else if (el.tagName === 'INPUT') {
        el.placeholder = t('panel_placeholder_input_diameter');

      } else if (el.tagName === 'BUTTON') {
        const action = el.dataset?.action || '';
        if (action === 'calculate') {
          const label = t('panel_button_calculate');
          el.textContent = label;
          el.setAttribute('aria-label', label);
          el.removeAttribute('title');
        } else if (action === 'reset') {
          const label = t('panel_button_reset');
          el.textContent = label;
          el.setAttribute('aria-label', label);
          el.removeAttribute('title');
        } else if (action === 'create') {
          const label = t('panel_button_create');
          el.setAttribute('aria-label', label);
          el.removeAttribute('title');
          // textContent не чіпаємо → лишається іконка
        }

      } else if (el.classList.contains('panel-note')) {
        if (id === 'selectFirstObject')            el.textContent = t('note_select_first_object');
        else if (id === 'setScaleFirstObject')     el.textContent = t('note_set_scale_first_object');
        else if (id === 'createFirstObject')       el.textContent = t('note_create_first_object');
        else if (id === 'selectSecondObject')      el.textContent = t('note_select_second_object');
        else if (id === 'createSecondObject')      el.textContent = t('note_create_second_object');
        else if (id === 'visualizationControls')   el.textContent = t('note_visualization_controls');

      } else if (el.classList.contains('panel-section-title')) {
        const key = el.getAttribute('data-i18n-key');
        if (key) el.textContent = t(key);
      }
    });
  };

  document.addEventListener('languageChanged', onLangChanged);

  // ==== Рендер панелі
  const container = document.getElementById('left-panel');
  if (!container) return;

  panelConfig.forEach(sec => {
    // Службовий рядок простого тексту між секціями
    if (sec.type === 'note') {
      const note = document.createElement('div');
      note.className = sec.className || 'panel-note';
      if (sec.i18nKey) note.setAttribute('data-i18n-key', sec.i18nKey);
      note.textContent = sec.text || '';
      container.append(note);
      return;
    }

    // головна секція
    const det = document.createElement('details');
    det.id = sec.id;

    const sum = document.createElement('summary');
    sum.textContent = sec.title;
    det.append(sum);

    // вміст секції
    const content = document.createElement('div');
    content.className = 'section-content';
    det.append(content);

    // підсекції
    if (Array.isArray(sec.children)) {
      sec.children.forEach(child => {
        const subDet = document.createElement('details');
        subDet.id = child.id;

        const subSum = document.createElement('summary');
        subSum.textContent = child.title;
        subDet.append(subSum);

        const subContent = document.createElement('div');
        subContent.className = 'section-content';
        subDet.append(subContent);

        if (Array.isArray(child.fields)) {
          child.fields.forEach(f => {
            const el = createField(f);
            subContent.append(el);
          });
        }

        // Навігація між підрежимами
        subSum.addEventListener('click', (e) => {
          e.preventDefault();

          const leftPanel = document.getElementById('left-panel');
          const opening = !subDet.open;

          if (leftPanel) {
            leftPanel.querySelectorAll('#left-panel details details').forEach(other => {
              if (other !== subDet) other.open = false;
            });
            const containerDet = subDet.closest('#left-panel > details');
            leftPanel.querySelectorAll('#left-panel > details').forEach(top => {
              if (top !== containerDet) top.open = false;
            });
          }

          resetAllUI();
          subDet.open = opening;
        });

        content.append(subDet);
      });

    } else if (Array.isArray(sec.fields)) {
      // якщо без підсекцій — просто поля
      sec.fields.forEach(f => {
        const el = createField(f);
        content.append(el);
      });
    }

    // Закриття інших головних секцій при відкритті цієї
    sum.addEventListener('click', (e) => {
      e.preventDefault();

      const leftPanel = document.getElementById('left-panel');
      const isContainer = Array.isArray(sec.children);
      const opening = !det.open;

      if (leftPanel) {
        leftPanel.querySelectorAll('#left-panel details details').forEach(d => d.open = false);
        leftPanel.querySelectorAll('#left-panel > details').forEach(other => {
          if (other !== det && !ALWAYS_OPEN_SECTIONS.has(other.id)) other.open = false;
        });
      }

      resetAllUI();
      det.open = opening;

      if (!opening && isContainer) {
        det.querySelectorAll('details').forEach(d => d.open = false);
      }
    });

    if (ALWAYS_OPEN_SECTIONS.has(sec.id)) det.open = true;

    container.append(det);
  });

  // Після рендера інітимо дані
  getMode('univers_diameter')?.initBlock?.();
  getMode('univers_distance')?.initBlock?.();
  getMode('univers_luminosity')?.initBlock?.();
  getMode('univers_mass')?.initBlock?.();
  getMode('history')?.initBlock?.();
  getMode('money')?.initBlock?.();
  getMode('math')?.initBlock?.();
  getMode('geo_area')?.initBlock?.();
  getMode('geo_population')?.initBlock?.();
  getMode('geo_objects')?.initBlock?.();
}
