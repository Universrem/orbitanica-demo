//js/panel.js

'use strict';

import { resetAllUI, resetScreenUI } from './events/reset.js';
import { getMode } from './modes/registry.js';
import './modes/builtin.js'; // реєструє стандартні режими (side-effect)

function getIconForAction(action) {
  if (action === 'create')     return '/res/icons/add.png';
  if (action === 'calculate')  return '/res/icons/play.png';
  if (action === 'reset')      return '/res/icons/stop.png';
  return '';
}

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
  el.className = 'icon-button';
  // старий контракт: і id, і data-action лишаються
  el.id = f.id;                 // ⚠️ дубльовані id залишаємо для стилів
  el.dataset.action = f.id;     // логіка дивиться на data-action

  // текст мітки беремо з f.text (він уже локалізований на момент рендера)
  const label = String(f.text || '').trim();
  if (label) {
  el.setAttribute('aria-label', label);
  // НЕ ставимо title для іконкових кнопок (щоб не було нативного тултіпа)
  if (!el.classList.contains('icon-button')) {
    el.title = label;
  }
}


  // всередині — лише іконка
  const img = document.createElement('img');
  img.className = 'btn-icon';
  img.src = getIconForAction(el.dataset.action);
  img.alt = ''; // декоративна
  img.setAttribute('aria-hidden', 'true');
  el.append(img);
  el.removeAttribute('title');
el.querySelectorAll('[title]').forEach(n => n.removeAttribute('title'));
}
 
    else if (f.type === 'text') {
    el = document.createElement('div');
    el.id = f.id; // тут ідентичні id зустрічаються у різних підсекціях — ок для нашого апдейту текстів
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
  const ALWAYS_OPEN_SECTIONS = new Set(); // нічого не лишаємо відкритим за замовчуванням

  const panelConfig = [

    { type: 'note', i18nKey: 'panel_note_scenes', text: t('panel_note_scenes'), className: 'panel-section-title' },

    { id: 'scene_day', title: t('panel_title_scene_day') },
    { id: 'interesting', title: t('panel_title_interesting') },

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
            { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
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
            { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
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
            { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
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
            { type: 'input', id: 'moneyBaselineDiameter',   placeholder: t('panel_placeholder_input_diameter') },
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
            { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',                 text: t('panel_button_reset') },

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
            { type: 'button', id: 'calculate',             text: t('panel_button_calculate') },
            { type: 'button', id: 'reset',                 text: t('panel_button_reset') }
          ]
        }
      ]
    },

  /**   {
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
    } */
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
    document.querySelectorAll('#left-panel select, #left-panel input, #left-panel button, #left-panel .panel-note, #left-panel .panel-section-title').forEach(el => {
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
  const action = el.dataset?.action || '';
  let label = '';
  if (action === 'calculate') label = t('panel_button_calculate');
  else if (action === 'reset') label = t('panel_button_reset');
  else if (action === 'create') label = t('panel_button_create');

if (label) {
  el.setAttribute('aria-label', label);
  if (!el.classList.contains('icon-button')) {
    el.title = label;
  }
}


}


else if (el.classList.contains('panel-note')) {
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
      // зберігаємо ключ для реакції на зміну мови
      if (sec.i18nKey) note.setAttribute('data-i18n-key', sec.i18nKey);
      note.textContent = sec.text || '';
      container.append(note);
      return; // переходимо до наступного елемента panelConfig
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

        // Закриваємо інші підсекції, якщо відкрили цю
// Єдина поведінка для всіх підрежимів (усіх секцій):
// - якщо клік по відкритому підрежиму → закрити його і виконати ПОВНИЙ reset
// - якщо клік по іншому підрежиму → закрити ВСІ інші підрежими (у всій панелі),
//   виконати ПОВНИЙ reset і відкрити цей
// Єдина поведінка для підрежимів:
// - клік по відкритому підрежиму → закрити його + повний reset
// - клік по іншому підрежиму → закрити ВСІ інші підрежими і топ-рівневі режими,
//   виконати повний reset і відкрити цей
subSum.addEventListener('click', (e) => {
  e.preventDefault();

  const wasOpen = subDet.open === true;
  const root = document.getElementById('left-panel');

  if (root) {
    // Закрити всі підрежими у всіх секціях
    root.querySelectorAll('#left-panel details details').forEach(other => {
      if (other !== subDet) other.open = false;
    });
    // Закрити всі топ-рівневі режими (history/money/math тощо), крім контейнерів
const containerDet = subDet.closest('#left-panel > details');
root.querySelectorAll('#left-panel > details').forEach(top => {
  if (top !== containerDet) top.open = false;
});

  }

  if (wasOpen) {
    subDet.open = false;
    resetAllUI();
    return;
  }

  resetScreenUI(); // легкий reset: НЕ чистить селекти з даними
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
// Клік по головному summary
sum.addEventListener('click', (e) => {
  e.preventDefault();

  const leftPanel = document.getElementById('left-panel');
  const isContainer = Array.isArray(sec.children); // univers/geo: список підрежимів

if (isContainer) {
  const wasOpen = det.open === true;

  // закрити всі інші топ-рівневі секції
  document.querySelectorAll('#left-panel > details').forEach(other => {
    if (other !== det) other.open = false;
  });

  if (wasOpen) {
    // закриваємо контейнер + підсекції та робимо ПОВНИЙ reset
    det.open = false;
    det.querySelectorAll('details').forEach(d => d.open = false);
    resetAllUI();
  } else {
    // відкриваємо контейнер із чистого стану
    resetScreenUI(); // не чіпає вміст форм/випадайок
    det.open = true;
  }
  return;
}


  // Режим без підрежимів (history/money/math/…)
  const wasOpen = det.open === true;

  if (leftPanel) {
    // Закрити всі підрежими у всіх контейнерах
    leftPanel.querySelectorAll('#left-panel details details').forEach(d => d.open = false);
    // Закрити всі інші топ-рівневі режими (окрім контейнерів і цього)
    leftPanel.querySelectorAll('#left-panel > details').forEach(other => {
      if (other !== det && !ALWAYS_OPEN_SECTIONS.has(other.id)) other.open = false;
    });
  }

  if (wasOpen) {
    det.open = false;
    resetAllUI(); // клік по відкритому → закрити й повністю очистити
    return;
  }

  resetAllUI(); // перехід з іншого режиму → повний reset
  // Контейнери (univers/geo) лишаємо відкритими
det.open = true; // просто відкриваємо обраний режим

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

  // ==== Авто-скидання при переході у будь-яку іншу секцію лівої панелі
  const leftPanel = document.getElementById('left-panel');
  if (leftPanel && !leftPanel.__orbitResetHookAttached) {
    leftPanel.addEventListener('click', (e) => {
  const sum = e.target.closest('summary');
  if (!sum || !leftPanel.contains(sum)) return;

  const det = sum.parentElement; // <details>

  // Працюємо лише для ГОЛОВНИХ секцій (#left-panel > details)
  const isTopLevel = det && det.parentElement === leftPanel;

  if (isTopLevel && det.tagName === 'DETAILS' && !det.open) {
    // при переході між головними секціями — легкий "екранний" ресет
    resetScreenUI();
  }
}, true);


    // Захист від повторного підвішування
    leftPanel.__orbitResetHookAttached = true;
  }
}
