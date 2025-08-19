//full/js/events/panel_buttons.js

'use strict';

import { openCreateModal } from '../userObjects/modal.js';
import { getDiameterData, loadUniverseLibrary } from '../data/data_diameter.js';
import { loadBaseUnits, convertUnit } from '../utils/unit_converter.js';
import { setObject1Scale, addObject2Circle, getCurrentScale } from '../calc/calculate_diameter.js';
import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { resetAllUI } from './reset.js';
import { getColorForKey } from '../utils/color.js';
import { setCircleLabelTextById, setCircleLabelKeyById } from '../globe/circles.js';

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

    // працюємо лише в межах блоку діаметрів
    const block = btn.closest('#univers_diameter');
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
          const data = getDiameterData();
          if (!data) {
            console.warn('❌ Не заповнені всі поля або ще не завантажена бібліотека univers.json.');
            return;
          }

          // 1) Задати масштаб за об'єктом 1
          const color1 = getColorForKey(`diam:${data.object1.name || data.object1.libIndex}`);
          const baselineId = setObject1Scale(
            data.object1.diameterReal,
            data.object1.unit,
            data.object1.diameterScaled,
            color1
          );

          // 2) Об'єкт 2 (опціонально)
          if (data.object2) {
            const color2 = getColorForKey(`diam:${data.object2.name || data.object2.libIndex}`);

            const scale = getCurrentScale();
            let obj2ScaledMeters = null;
            if (scale && isFinite(scale)) {
              const real2m = Number(convertUnit(data.object2.diameterReal, data.object2.unit, 'm', 'diameter'));
              if (isFinite(real2m) && real2m > 0) obj2ScaledMeters = real2m * scale;
            }
// Рішення щодо візуалізації Об'єкта 2 (без текстів; інфопанель відрендерить повідомлення)
const R_EARTH = 6_371_000;
const LIM_RADIUS = Math.PI * R_EARTH;
const EPS_M = 1;

let invisibleReason = null;
let requiredBaselineMeters = null;
let id2 = null;

if (obj2ScaledMeters != null && isFinite(obj2ScaledMeters)) {
  const r2 = obj2ScaledMeters / 2;
  if (r2 > LIM_RADIUS + EPS_M) {
    // Не малюємо. Порахуємо “який має бути діаметр Об’єкта 1”, щоб Об’єкт 2 став антиподом.
    const real1m_forHint = Number(convertUnit(data.object1.diameterReal, data.object1.unit, 'm', 'diameter'));
    const real2m_forHint = Number(convertUnit(data.object2.diameterReal, data.object2.unit, 'm', 'diameter'));
    if (isFinite(real1m_forHint) && real1m_forHint > 0 && isFinite(real2m_forHint) && real2m_forHint > 0) {
      requiredBaselineMeters = (2 * Math.PI * R_EARTH) * (real1m_forHint / real2m_forHint);
    }
    invisibleReason = 'tooLarge';
  } else {
    // В межах — малюємо як раніше
    id2 = addObject2Circle(data.object2.diameterReal, data.object2.unit, color2);
  }
}

            addResult({
              libIndex: data.object2.libIndex,
              realValue: data.object2.diameterReal,
              realUnit: data.object2.unit,
              scaledMeters: obj2ScaledMeters,
              name: data.object2.name,
              description: data.object2.description,
              color: color2,
              invisibleReason,
              requiredBaselineMeters

            });

            if (id2) {
              setCircleLabelTextById(id2, data.object2.name);
              setCircleLabelKeyById(
                id2,
                Number.isInteger(data.object2.libIndex) && data.object2.libIndex >= 0
                  ? { type: 'lib', libIndex: data.object2.libIndex }
                  : { type: 'custom', customName: data.object2.name }
              );
            }
          }

          // 3) Інфопанель — baseline (О1)
          setBaselineResult({
            libIndex: data.object1.libIndex,
            realValue: data.object1.diameterReal,
            realUnit: data.object1.unit,
            scaledMeters: data.object1.diameterScaled,
            name: data.object1.name,
            description: data.object1.description,
            color: color1
          });

          // 🔒 Старт сесії: блокуємо зміну мови до скидання (одноразово)
          if (!window.__orbitSessionActive) {
            window.__orbitSessionActive = true;
            window.dispatchEvent(new CustomEvent('orbit:session-start'));
          }

          // 4) Лейбл/ключ для Об'єкта 1
          if (baselineId) {
            setCircleLabelTextById(baselineId, data.object1.name);
            setCircleLabelKeyById(
              baselineId,
              Number.isInteger(data.object1.libIndex) && data.object1.libIndex >= 0
                ? { type: 'lib', libIndex: data.object1.libIndex }
                : { type: 'custom', customName: data.object1.name }
            );
          }

          // 5) Зафіксувати поля Об'єкта 1, але НЕ додавати/використовувати .is-active як логічний прапор
          if (object1Group) {
            object1Group.classList.add('is-locked');
            object1Group.querySelectorAll('select, input, button').forEach((el) => {
              const act = el.dataset?.action || el.id || '';
              if (act === 'calculate' || act === 'reset') return; // не блокуємо ці кнопки
              el.disabled = true;
            });
          }

          console.log('✅ Розрахунок діаметра виконано');
          return;
        }

        // --- Інші режими (плейсхолдери) ---
        if (subblock.id.startsWith('univers_distance')) console.log('📏 distance: TODO');
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
