// full/js/events/panel_buttons.js
'use strict';

import { openCreateModal } from '../userObjects/modal.js';
import { loadUniverseLibrary } from '../data/universe.js';
import { loadBaseUnits } from '../utils/unit_converter.js';
import { resetAllUI } from './reset.js';
import { getMode } from '../modes/registry.js';
import '../modes/builtin.js'; // реєструє режими (side-effect)

// Знімати .is-invalid при вводі (один раз)
if (!window.__orbitInvalidFix) {
  const clearInvalid = (e) => {
    const el = e.target;
    if (
      el &&
      (el.matches('#left-panel select') ||
        el.matches('#left-panel input[type="number"], #left-panel input[type="text"]'))
    ) {
      el.classList.remove('is-invalid');
    }
  };
  document.addEventListener('input', clearInvalid, true);
  document.addEventListener('change', clearInvalid, true);
  window.__orbitInvalidFix = true;
}

// Попередньо підтягуємо довідники
loadUniverseLibrary();
loadBaseUnits();

console.log('[panel_buttons] ready');

// ─────────────────────────────────────────────────────────────
// Основні кнопки: Calculate / Reset (делеговано)
if (!window.__panelButtonsBound) {
  window.__panelButtonsBound = true;

  const busyScopes = new WeakMap();

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset?.action || btn.id;
    if (!action) return;

    // Контейнер будь-якого режиму (ВАЖЛИВО: для money теж)
    const scope = btn.closest('details[id]');
    if (!scope) return;

    // 1) Calculate
    if (action === 'calculate') {
      e.preventDefault();

      if (busyScopes.get(scope)) return;
      busyScopes.set(scope, true);

      try {
        // валідація двох груп
        const groups = scope.querySelectorAll('.sector-block');
        const object1Group = groups[0] || null;
        const object2Group = groups[1] || null;

        const validateGroup = (grp) => {
          if (!grp) return true;
          if (grp.classList.contains('is-locked')) return true;
          const req = grp.querySelectorAll(
            'select:not([disabled]), input[type="number"]:not([disabled])'
          );
          let ok = true;
          req.forEach((el) => {
            const empty =
              el.tagName === 'SELECT'
                ? el.selectedIndex <= 0 || !el.value
                : String(el.value ?? '').trim() === '';
            el.classList.toggle('is-invalid', empty);
            if (empty) ok = false;
          });
          return ok;
        };

        const g1ok = validateGroup(object1Group);
        const g2ok = validateGroup(object2Group);
        if (!g1ok || !g2ok) return;

        const modeId = scope.id;
        const mode = getMode(modeId);
        if (mode && typeof mode.onCalculate === 'function') {
          mode.onCalculate({ scope, object1Group, object2Group });
        } else {
          console.warn('[panel_buttons] Невідомий режим або відсутній onCalculate:', modeId);
        }
      } finally {
        busyScopes.delete(scope);
        try {
          scope
            .querySelectorAll('button[data-action="calculate"], button[data-action="reset"]')
            .forEach((b) => b.classList.remove('is-active'));
        } catch {}
      }
      return;
    }

    // 2) Reset
    if (action === 'reset') {
      e.preventDefault();
      resetAllUI();
      console.log('[panel_buttons] ✅ Повний скидання виконано');
      return;
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Кнопки "Створити" (для всіх режимів, крім history)
if (!window.__panelCreateBound) {
  window.__panelCreateBound = true;

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!(btn instanceof HTMLElement)) return;

    const action = btn.dataset?.action || btn.id;
    if (action !== 'create') return;

    const block = btn.closest('details[id]');
    if (!block) return;

    const blockId = block.id || '';
    if (blockId === 'history') return;

    // mode з id (univers_* → *), money → money
    let mode = blockId;
    if (mode.startsWith('univers_')) mode = mode.slice('univers_'.length);

    // слот за позицією групи
    const group = btn.closest('.sector-block');
    const groups = Array.from(block.querySelectorAll('.sector-block'));
    const slot = groups.indexOf(group) === 0 ? 'object1' : 'object2';

    // поточна категорія
    const presetCategoryEl = block.querySelector(
      slot === 'object1'
        ? 'select[id$="CategoryObject1"]'
        : 'select[id$="CategoryObject2"]'
    );
    const presetCategory =
      presetCategoryEl && typeof presetCategoryEl.value === 'string' ? presetCategoryEl.value : '';

    await openCreateModal({ mode, presetCategory, slot });
  });
}
