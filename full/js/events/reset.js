// full/js/events/reset.js
'use strict';

import { circlesLayer } from '../globe/circles.js';
import { clearInfoPanel } from '../ui/infoPanel.js';

/**
 * Повний скидання інтерфейсу та візуалізації (універсально для всіх розділів):
 * 1) Сповіщає модулі про скидання (вони самі обнуляють свій внутрішній state)
 * 2) Стирає кола, ховає інфопанель
 * 3) Очищає всі select/input/checkbox у лівій панелі (без переліку ID)
 * 4) Повертає кнопки до білого фону (рамки зберігаються)
 */
export function resetAllUI() {
  // 1) 🔔 Спершу сповіщаємо всі модулі: «йде скидання state»
  //    (щоб жоден «вотчер» не підставляв значення назад у поля)
  window.dispatchEvent(new Event('orbit:ui-reset'));

  // 2) Візуалізація та інфопанель
  try { circlesLayer && circlesLayer.clear && circlesLayer.clear(); } catch (e) {}
  try { clearInfoPanel && clearInfoPanel(); } catch (e) {}

  // 3) Очистити форми у лівій панелі (будь-який розділ/режим)
  resetFormControls();


  // 4) Кнопки — у початковий (білий) фон; рамки залишаються
    // Зняти підсвітку з усіх пар кнопок у лівій панелі (id можуть повторюватися у підсекціях)
    document.querySelectorAll('#left-panel button#calculate').forEach(b => b.classList.remove('is-active'));
    document.querySelectorAll('#left-panel button#reset').forEach(b => b.classList.remove('is-active'));

}

/** Очищення контролів без хардкоду ID */
function resetFormControls(root = document.getElementById('left-panel')) {
  if (!root) return;

  // a) select → placeholder (index 0) + подія change
  root.querySelectorAll('select').forEach(sel => {
    if (sel.options && sel.options.length) sel.selectedIndex = 0;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // b) input text/number → '' + подія input
  root.querySelectorAll('input[type="text"], input[type="number"]').forEach(inp => {
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // c) checkbox → false + подія change
  root.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // d) Зняти блокування та прибрати помилкові підсвітки
  root.querySelectorAll('.sector-block.is-locked').forEach(b => b.classList.remove('is-locked'));
  root.querySelectorAll('select[disabled], input[disabled], button[disabled]').forEach(el => el.disabled = false);
  root.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

}


