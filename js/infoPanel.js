// js/infoPanel.js
// ─────────────────────────────────────────────────────────────
// Показує інформацію про масштабовані об’єкти трьома мовами.
// • Обирає шаблони info.diameter / info.distance / info.value / info.time із translations.json
// • Підставляє числа й перекладені одиниці
// • Ховається при зміні мови

import { t } from './i18n.js';
import { formatNice } from './formatNice.js';

const PANEL_SELECTOR = '#info-panel';
let panel = null;

/** Підставляє змінні у рядок‐шаблон {name} */
function fill(template, vars) {
  return template.replace(/{(\w+(?:\.\w+)*)}/g, (_, k) => vars[k] ?? k);
}

export function initInfoPanel(container = PANEL_SELECTOR) {
  panel = document.querySelector(container);
  if (!panel) {
    console.warn(`[infoPanel] Контейнер ${container} не знайдено`);
    return;
  }
  panel.innerHTML = `<h2 class="title"></h2><p class="sentence"></p>`;
  panel.classList.add('info-panel', 'hidden');
}

export function hideInfo() {
  panel?.classList.add('hidden');
}

/**
 * Показати картку
 * @param {object} p
 *   type      – 'diameter' | 'distance' | 'value' | 'time'
 *   title     – заголовок
 *   obj1Name, obj2Name, obj3Name – назви об’єктів
 *   для diameter/distance: real1_m, real2_m, scaled1_m, scaled2_m
 *   для value: field, unit, v1.{val}, v2.{val}, s1.{val,unit}, s2.{val,unit}
 *   для time: real1_yr, real2_yr, real3_yr, scaled1_m, scaled2_m, scaled3_m
 */
export function showInfo({
  type        = 'diameter',
  title       = '',
  obj1Name    = '',
  obj2Name    = '',
  obj3Name    = '',
  real1_m     = 0,
  real2_m     = 0,
  scaled1_m   = 0,
  scaled2_m   = 0,
  field       = '',
  unit        = '',
  v1          = { val: '' },
  v2          = { val: '' },
  s1          = { val: '', unit: '' },
  s2          = { val: '', unit: '' },
  real1_yr    = 0,
  real2_yr    = 0,
  real3_yr    = 0,
  scaled3_m   = 0
} = {}) {
  if (!panel) {
    initInfoPanel();
    if (!panel) return;
  }

  // Заголовок
  panel.querySelector('.title').textContent = title;

  let vars;
  let key;

  if (type === 'time') {
  // 1) Відформатуємо «приємні» відстані
  const F1 = formatNice(scaled1_m);
  const F2 = formatNice(scaled2_m);
  const F3 = formatNice(scaled3_m);

  // 2) Зберемо vars під ключі {s1.val}, {s1.unit} тощо
  vars = {
    obj1Name, obj2Name, obj3Name,
    real1_yr, real2_yr, real3_yr,
    's1.val': F1.val, 's1.unit': t(F1.unitKey),
    's2.val': F2.val, 's2.unit': t(F2.unitKey),
    's3.val': F3.val, 's3.unit': t(F3.unitKey)
  };
  key = 'info.time';

  } else if (type === 'value') {
  vars = {
    obj1Name, obj2Name,
    field, 
    unit: t(unit),
    'v1.val': v1.val,
    'v1.unit': t(v1.unit),
    'v2.val': v2.val,
    'v2.unit': t(v2.unit),
    's1.val': s1.val,
    's1.unit': t(s1.unit || unit),
    's2.val': s2.val,
    's2.unit': t(s2.unit || unit)
  };
  key = 'info.value';
}else {
    const R1 = formatNice(real1_m);
    const R2 = formatNice(real2_m);
    const S1 = formatNice(scaled1_m);
    const S2 = formatNice(scaled2_m);

    vars = {
      obj1Name, obj2Name,
      'r1.val': R1.val, 'r1.unit': t(R1.unitKey),
      'r2.val': R2.val, 'r2.unit': t(R2.unitKey),
      'd1.val': R1.val, 'd1.unit': t(R1.unitKey),
      'd2.val': R2.val, 'd2.unit': t(R2.unitKey),
      's1.val': S1.val, 's1.unit': t(S1.unitKey),
      's2.val': S2.val, 's2.unit': t(S2.unitKey)
    };
    key = (type === 'distance') ? 'info.distance' : 'info.diameter';
  }

  panel.querySelector('.sentence').textContent = fill(t(key), vars);
  panel.classList.remove('hidden');
}

document.addEventListener('languageChanged', hideInfo);

