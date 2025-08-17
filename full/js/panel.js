// full/js/panel.js
'use strict';

import { initUniversDiameterBlock } from './blocks/univers_diameter.js';
import { resetAllUI, resetScreenUI } from './events/reset.js';

/** Фабрика елементів полів лівої панелі */
function createField(f) {
  let el;

  if (f.type === 'select') {
    el = document.createElement('select');
    el.id = f.id; // select/input мають унікальні id — залишаємо
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
    el.id = f.id; // унікальний id потрібен для збирання даних
    el.placeholder = f.placeholder;

  } else if (f.type === 'button') {
    el = document.createElement('button');
    // ❗ КЛЮЧОВА ЗМІНА: замість дубльованих id — використовуємо data-action
    // (сумісність з існуючим кодом збережено у handlers/css)
    el.dataset.action = f.id;         // 'calculate' | 'reset' | 'create'
    el.textContent = f.text;

  } else if (f.type === 'text') {
    el = document.createElement('div');
    el.id = f.id; // тут ідентичні id зустрічаються у різних підсекціях — ок для нашого апдейту текстів
    el.textContent = f.text;
    el.classList.add('panel-note');

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

  const panelConfig = [
    { id: 'comparison', title: t('panel_title_comparison') },
    {
      id: 'univers',
      title: t('panel_title_univers'),
      children: [
        {
          id: 'univers_diameter', title: t('panel_title_univers_diameter'),
          fields: [
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
                { type: 'select', id: 'diamCategoryObject1', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'diamObject1',         placeholder: t('panel_placeholder_object1') },
                { type: 'text',   id: 'setScaleFirstObject', text: t('note_set_scale_first_object') },
                { type: 'input',  id: 'diamCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
                { type: 'text',   id: 'createFirstObject',   text: t('note_create_first_object') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
                { type: 'select', id: 'diamCategoryObject2', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'diamObject2',         placeholder: t('panel_placeholder_object2') },
                { type: 'text',   id: 'createSecondObject',  text: t('note_create_second_object') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'visualizationControls', text: t('note_visualization_controls') },
                { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
              ]
            }
          ]
        },
        {
          id: 'univers_distance', title: t('panel_title_univers_distance'),
          fields: [
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
                { type: 'select', id: 'distCategoryObject1', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'distObject1',         placeholder: t('panel_placeholder_object1') },
                { type: 'text',   id: 'setScaleFirstObject', text: t('note_set_scale_first_object') },
                { type: 'input',  id: 'distCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
                { type: 'text',   id: 'createFirstObject',   text: t('note_create_first_object') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
                { type: 'select', id: 'distCategoryObject2', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'distObject2',         placeholder: t('panel_placeholder_object2') },
                { type: 'text',   id: 'createSecondObject',  text: t('note_create_second_object') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'visualizationControls', text: t('note_visualization_controls') },
                { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
              ]
            }
          ]
        },
        {
          id: 'univers_luminosity', title: t('panel_title_univers_luminosity'),
          fields: [
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
                { type: 'select', id: 'lumiCategoryObject1', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'lumiObject1',         placeholder: t('panel_placeholder_object1') },
                { type: 'text',   id: 'setScaleFirstObject', text: t('note_set_scale_first_object') },
                { type: 'input',  id: 'lumiCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
                { type: 'text',   id: 'createFirstObject',   text: t('note_create_first_object') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
                { type: 'select', id: 'lumiCategoryObject2', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'lumiObject2',         placeholder: t('panel_placeholder_object2') },
                { type: 'text',   id: 'createSecondObject',  text: t('note_create_second_object') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'visualizationControls', text: t('note_visualization_controls') },
                { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
              ]
            }
          ]
        },
        {
          id: 'univers_mass', title: t('panel_title_univers_mass'),
          fields: [
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
                { type: 'select', id: 'massCategoryObject1', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'massObject1',         placeholder: t('panel_placeholder_object1') },
                { type: 'text',   id: 'setScaleFirstObject', text: t('note_set_scale_first_object') },
                { type: 'input',  id: 'massCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
                { type: 'text',   id: 'createFirstObject',   text: t('note_create_first_object') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
                { type: 'select', id: 'massCategoryObject2', placeholder: t('panel_placeholder_category') },
                { type: 'select', id: 'massObject2',         placeholder: t('panel_placeholder_object2') },
                { type: 'text',   id: 'createSecondObject',  text: t('note_create_second_object') },
                { type: 'button', id: 'create',              text: t('panel_button_create') },
              ]
            },
            {
              type: 'group', className: 'sector-block', children: [
                { type: 'text',   id: 'visualizationControls', text: t('note_visualization_controls') },
                { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
                { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
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
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
            { type: 'select', id: 'histCategoryObject1', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'histObject1',         placeholder: t('panel_placeholder_event1') },
            { type: 'text',   id: 'setScaleFirstObject', text: t('note_set_scale_first_object') },
            { type: 'input',  id: 'histCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
            { type: 'text',   id: 'createFirstObject',   text: t('note_create_first_object') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
            { type: 'select', id: 'histCategoryObject2', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'histObject2',         placeholder: t('panel_placeholder_event2') },
            { type: 'text',   id: 'createSecondObject',  text: t('note_create_second_object') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'visualizationControls', text: t('note_visualization_controls') },
            { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
          ]
        }
      ]
    },
    {
      id: 'math', title: t('panel_title_math'),
      fields: [
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
            { type: 'select', id: 'mathCategoryObject1', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'mathObject1',         placeholder: t('panel_placeholder_object1') },
            { type: 'text',   id: 'setScaleFirstObject', text: t('note_set_scale_first_object') },
            { type: 'input',  id: 'mathCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
            { type: 'text',   id: 'createFirstObject',   text: t('note_create_first_object') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
            { type: 'select', id: 'mathCategoryObject2', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'mathObject2',         placeholder: t('panel_placeholder_object2') },
            { type: 'text',   id: 'createSecondObject',  text: t('note_create_second_object') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'visualizationControls', text: t('note_visualization_controls') },
            { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
          ]
        }
      ]
    },
    {
      id: 'money', title: t('panel_title_money'),
      fields: [
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
            { type: 'select', id: 'moneCategoryObject1', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'moneObject1',         placeholder: t('panel_placeholder_object1') },
            { type: 'text',   id: 'setScaleFirstObject', text: t('note_set_scale_first_object') },
            { type: 'input',  id: 'moneCircleObject1',   placeholder: t('panel_placeholder_input_diameter') },
            { type: 'text',   id: 'createFirstObject',   text: t('note_create_first_object') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
            { type: 'select', id: 'moneCategoryObject2', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'moneObject2',         placeholder: t('panel_placeholder_object2') },
            { type: 'text',   id: 'createSecondObject',  text: t('note_create_second_object') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'visualizationControls', text: t('note_visualization_controls') },
            { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
          ]
        }
      ]
    },
    {
      id: 'geo', title: t('panel_title_geo'),
      fields: [
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
            { type: 'select', id: 'geoCategoryObject1',  placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'geoObject1',          placeholder: t('panel_placeholder_object1') },
            { type: 'text',   id: 'setScaleFirstObject', text: t('note_set_scale_first_object') },
            { type: 'input',  id: 'geoCircleObject1',    placeholder: t('panel_placeholder_input_diameter') },
            { type: 'text',   id: 'createFirstObject',   text: t('note_create_first_object') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
            { type: 'select', id: 'geoCategoryObject2',  placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'geoObject2',          placeholder: t('panel_placeholder_object2') },
            { type: 'text',   id: 'createSecondObject',  text: t('note_create_second_object') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'button', id: 'create',              text: t('panel_button_create') },
            { type: 'text',   id: 'visualizationControls', text: t('note_visualization_controls') },
            { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
          ]
        }
      ]
    },
    {
      id: 'other', title: t('panel_title_other'),
      fields: [
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'selectFirstObject',   text: t('note_select_first_object') },
            { type: 'select', id: 'otherCategoryObject1', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'otherObject1',        placeholder: t('panel_placeholder_object1') },
            { type: 'text',   id: 'setScaleFirstObject', text: t('note_set_scale_first_object') },
            { type: 'input',  id: 'otherCircleObject1',  placeholder: t('panel_placeholder_input_diameter') },
            { type: 'text',   id: 'createFirstObject',   text: t('note_create_first_object') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'selectSecondObject',  text: t('note_select_second_object') },
            { type: 'select', id: 'otherCategoryObject2', placeholder: t('panel_placeholder_category') },
            { type: 'select', id: 'otherObject2',        placeholder: t('panel_placeholder_object2') },
            { type: 'text',   id: 'createSecondObject',  text: t('note_create_second_object') },
            { type: 'button', id: 'create',              text: t('panel_button_create') },
          ]
        },
        {
          type: 'group', className: 'sector-block', children: [
            { type: 'text',   id: 'visualizationControls', text: t('note_visualization_controls') },
            { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
          ]
        }
      ]
    }
  ];

  // ==== Reactivity на зміну мови (всередині initLeftPanel, щоб мати t у замиканні)
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
    document.querySelectorAll('#left-panel select, #left-panel input, #left-panel button, #left-panel .panel-note').forEach(el => {
      const id = el.id;
      const action = el.dataset?.action || '';

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
        // 🔹 Тепер через data-action
        if (action === 'calculate') el.textContent = t('panel_button_calculate');
        else if (action === 'reset') el.textContent = t('panel_button_reset');
        else if (action === 'create') el.textContent = t('panel_button_create');

      } else if (el.classList.contains('panel-note')) {
        if (id === 'selectFirstObject')            el.textContent = t('note_select_first_object');
        else if (id === 'setScaleFirstObject')     el.textContent = t('note_set_scale_first_object');
        else if (id === 'createFirstObject')       el.textContent = t('note_create_first_object');
        else if (id === 'selectSecondObject')      el.textContent = t('note_select_second_object');
        else if (id === 'createSecondObject')      el.textContent = t('note_create_second_object');
        else if (id === 'visualizationControls')   el.textContent = t('note_visualization_controls');
      }
    });
  };

  document.addEventListener('languageChanged', onLangChanged);

  // ==== Рендер панелі
  const container = document.getElementById('left-panel');
  if (!container) return;

  panelConfig.forEach(sec => {
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

        // Закриваємо інші підсекції, якщо відкрили цю
        subSum.addEventListener('click', (e) => {
          e.preventDefault();

          // Авто-скидання при переході у інший підрежим
          if (!subDet.open) { resetAllUI(); }

          // Закриваємо всі підсекції в межах цієї секції
          content.querySelectorAll('details').forEach(other => { other.open = false; });

          // Відкриваємо тільки цю
          subDet.open = true;
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
      document.querySelectorAll('#left-panel > details').forEach(other => { other.open = false; });
      det.open = true;
    });

    container.append(det);
  });

  // Після рендера інітимо дані для Діаметрів
  initUniversDiameterBlock();

  // ==== Авто-скидання при переході у будь-яку іншу секцію лівої панелі
  const leftPanel = document.getElementById('left-panel');
  if (leftPanel && !leftPanel.__orbitResetHookAttached) {
    leftPanel.addEventListener('click', (e) => {
      const sum = e.target.closest('summary');
      if (!sum || !leftPanel.contains(sum)) return;

      const det = sum.parentElement; // <details>
      if (det && det.tagName === 'DETAILS' && !det.open) {
        resetScreenUI();   // тільки почистити екран, baseline і масштаб залишити
      }
    }, true); // capture: до перемикання open

    // Захист від повторного підвішування
    leftPanel.__orbitResetHookAttached = true;
  }
}
