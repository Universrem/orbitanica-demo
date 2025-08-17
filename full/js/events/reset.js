'use strict';

import { circlesLayer } from '../globe/circles.js';
import { labelsLayer } from '../globe/globe.js';
import { clearInfoPanel } from '../ui/infoPanel.js';

/** Часткове очищення екрана (не чіпає форми/стан сесії/масштаб) */
export function resetScreenUI() {
  // ✅ ЯВНИЙ СИГНАЛ ПРО ЧАСТКОВЕ ОЧИЩЕННЯ (нічого не чистимо напряму)
  try { window.dispatchEvent(new CustomEvent('orbit:screen-partial-cleared', { detail: 'resetScreenUI' })); } catch {}

  // інфопанель — сховати список, але не стирати результати з пам'яті шарів
  try { clearInfoPanel({ hideOnly: true }); } catch {}

  // зняти підсвічування Start/Reset у лівій панелі (для повторного входу в підсекцію)
  const root = document.getElementById('left-panel');
  if (root) {
    root.querySelectorAll(
      'button#calculate.is-active, button#reset.is-active,' +
      'button[data-action="calculate"].is-active, button[data-action="reset"].is-active'
    ).forEach(el => el.classList.remove('is-active'));
  }
}

/** Повний скидання: нова сесія (скидає ВСЕ, у т.ч. масштаб і baseline) */
export function resetAllUI() {
  // 1) Дати знати всім модулям про повний reset (circles.js сам очистить свої шари/реєстр)
  try { window.dispatchEvent(new CustomEvent('orbit:ui-reset')); } catch {}

  // 2) Підстрахуємося локально (очистити обидва векторні шари)
  try { circlesLayer && circlesLayer.clear(); } catch {}
  try { labelsLayer && labelsLayer.clear(); } catch {}
  try { clearInfoPanel({ hideOnly: false }); } catch {}

  // 3) Очистити поля лівої панелі
  resetFormControls();

  // 4) Завершити сесію (розблокує перемикач мови тощо)
  window.__orbitSessionActive = false;
  try { window.dispatchEvent(new CustomEvent('orbit:session-end')); } catch {}
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
  root.querySelectorAll('select[disabled], input[disabled], button[disabled]')
    .forEach(el => { el.disabled = false; });
  root.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

  // e) зняти підсвічування Start/Reset у лівій панелі
  root.querySelectorAll(
    'button#calculate.is-active, button#reset.is-active,' +
    'button[data-action="calculate"].is-active, button[data-action="reset"].is-active'
  ).forEach(el => el.classList.remove('is-active'));
}
