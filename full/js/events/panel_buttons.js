//full/js/events/panel_buttons.js

'use strict';

import { openCreateModal } from '../userObjects/modal.js';
import { loadUniverseLibrary } from '../data/universe.js';
import { loadBaseUnits, convertUnit } from '../utils/unit_converter.js';
import { resetAllUI } from './reset.js';
import { onDistanceCalculate } from './distance_buttons.js';
import { onDiameterCalculate } from './diameter_buttons.js';



// ---- валідатор: знімати .is-invalid при вводі/виборі ----
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

// підтягуємо дані та одиниці заздалегідь
loadUniverseLibrary();
loadBaseUnits();

console.log('[panel_buttons] ready');

// ─────────────────────────────────────────────────────────────
// Делегований обробник основних кнопок (Calculate / Reset)
if (!window.__panelButtonsBound) {
  window.__panelButtonsBound = true;

  // коротка блокування лише на час розрахунку, по підсекції
  const busyScopes = new WeakMap();

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // працюємо лише в межах блоку діаметр, відстань
    const block = btn.closest('#univers_diameter, #univers_distance');

    if (!block) return;

    const action = btn.dataset?.action || btn.id;
    if (!action) return;

    // 1) "Розрахувати"
    if (action === 'calculate') {
      e.preventDefault();

      const scope = btn.closest('details'); // підсекція, де натиснули кнопку
      if (!scope) return;

      if (busyScopes.get(scope)) return; // запобігаємо подвійному старту
      busyScopes.set(scope, true);

      try {
        // === A) ВАЛІДАЦІЯ ОБОХ СЕКТОРІВ У ЦІЙ ПІДСЕКЦІЇ (Об'єкт 1 і Об'єкт 2) ===
        const groups = scope ? scope.querySelectorAll('.sector-block') : [];
        const object1Group = groups[0] || null;
        const object2Group = groups[1] || null;

        const validateGroup = (grp) => {
          if (!grp) return true;
          if (grp.classList.contains('is-locked')) return true; // уже зафіксований
          const req = grp.querySelectorAll('select:not([disabled]), input[type="number"]:not([disabled])');
          let ok = true;
          req.forEach((el) => {
            const empty =
              el.tagName === 'SELECT'
                ? el.selectedIndex <= 0
                : String(el.value ?? '').trim() === '';
            el.classList.toggle('is-invalid', empty);
            if (empty) ok = false;
          });
          return ok;
        };

        const isGroupEmpty = (grp) => {
          if (!grp) return true;
          const fields = grp.querySelectorAll(
            'select:not([disabled]), input[type="number"]:not([disabled]), input[type="text"]:not([disabled])'
          );
          for (const el of fields) {
            if (el.tagName === 'SELECT' && el.value) return false;
            if (el.type === 'number' && !isNaN(parseFloat(el.value))) return false;
            if (el.type === 'text' && String(el.value).trim()) return false;
          }
          return true;
        };

        const g1ok = validateGroup(object1Group);
        // ❗ Об'єкт 2 обов'язковий для старту
        const g2ok = validateGroup(object2Group);
        if (!g1ok || !g2ok) return; // є порожні поля — не рахуємо

        // === B) Визначаємо поточний режим цієї ж підсекції
        const subblock = btn.closest(
          '[id^="univers_diameter"], [id^="univers_distance"], [id^="univers_luminosity"], [id^="univers_mass"], [id^="history"], [id^="math"], [id^="money"], [id^="geo"], [id^="other"]'
        );
        if (!subblock) return;

        // --- ДІАМЕТР ---
                if (subblock.id.startsWith('univers_diameter')) {
          onDiameterCalculate({ scope, object1Group, object2Group });
          return;
        }

        // --- Відстань ---
        if (subblock.id.startsWith('univers_distance')) {
          onDistanceCalculate({ scope, object1Group, object2Group });
          return;
        }

        if (subblock.id.startsWith('univers_luminosity')) console.log('💡 luminosity: TODO');
        if (subblock.id.startsWith('univers_mass')) console.log('⚖ mass: TODO');
        if (subblock.id.startsWith('history')) console.log('🕰 history: TODO');
        if (subblock.id.startsWith('math')) console.log('➗ math: TODO');
        if (subblock.id.startsWith('money')) console.log('💰 money: TODO');
        if (subblock.id.startsWith('geo')) console.log('🗺 geo: TODO');
        if (subblock.id.startsWith('other')) console.log('📦 other: TODO');
      } finally {
        // Завжди зняти коротке блокування та прибрати декоративні активності
        const scope = btn.closest('details');
        busyScopes.delete(scope);
        try {
          scope && scope.querySelectorAll('button[data-action="calculate"], button[data-action="reset"]').forEach((b) => b.classList.remove('is-active'));
        } catch {}
      }

      return; // завершили гілку calculate
    }

    // 2) "Скинути"
    if (action === 'reset') {
      resetAllUI();
      console.log('✅ Повний скидання виконано');
      return;
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Делегований обробник для кнопок "Створити" у блоці ДІАМЕТРИ
if (!window.__panelCreateBound) {
  window.__panelCreateBound = true;

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!(btn instanceof HTMLElement)) return;

    const action = btn.dataset?.action || btn.id;
    if (action !== 'create') return;

    // Працюємо тільки коли клік всередині блоку "Діаметри"
    const block = btn.closest('#univers_diameter');
    if (!block) return;

    // Визначаємо слот за сектором
    const group = btn.closest('.sector-block');
    let slot = 'object2';
    if (group?.querySelector('#createFirstObject')) slot = 'object1';
    if (group?.querySelector('#createSecondObject')) slot = 'object2';

    // Підтягуємо попередньо вибрану категорію відповідного слота
    const presetCategoryEl = document.getElementById(
      slot === 'object1' ? 'diamCategoryObject1' : 'diamCategoryObject2'
    );
    const presetCategory =
      presetCategoryEl && typeof presetCategoryEl.value === 'string' ? presetCategoryEl.value : '';

    // Відкрити модалку створення
    await openCreateModal({ mode: 'diameter', presetCategory, slot });
  });
}
