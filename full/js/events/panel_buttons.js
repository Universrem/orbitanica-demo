// full/js/events/panel_buttons.js
'use strict';

import { openCreateModal } from '../userObjects/modal.js';
import { getDiameterData, loadUniverseLibrary } from '../data/data_diameter.js';
import { loadBaseUnits, convertUnit } from '../utils/unit_converter.js';
import { setObject1Scale, addObject2Circle, getCurrentScale } from '../calc/calculate_diameter.js';
import { setBaselineResult, addResult } from '../ui/infoPanel.js';
import { resetAllUI } from './reset.js';
import { getColorForKey } from '../utils/color.js';
import { setCircleLabelText } from '../globe/circles.js';


// ---- валідатор: знімати .is-invalid при вводі/виборі ----
// Вішаємо на document (capture), щоб працювало навіть якщо #left-panel ще не вставлений
if (!window.__orbitInvalidFix) {
  const clearInvalid = (e) => {
    const el = e.target;
    if (el && (el.matches('#left-panel select') || el.matches('#left-panel input[type="number"], #left-panel input[type="text"]'))) {
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

// Універсальний делегований обробник для всіх кнопок "calculate" і "reset"
document.addEventListener('click', (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLElement)) return;
  const id = btn.id;
  if (!id) return;

  // 1) "Розрахувати"
  if (id === 'calculate') {
    // === A) ВАЛІДАЦІЯ ОБОХ СЕКТОРІВ У ЦІЙ ПІДСЕКЦІЇ (Об'єкт 1 і Об'єкт 2) ===
    const scope = btn.closest('details'); // підсекція, де натиснули кнопку
    const groups = scope ? scope.querySelectorAll('.sector-block') : [];
    const object1Group = groups[0] || null;
    const object2Group = groups[1] || null;
    const validateGroup = (grp) => {
  if (!grp) return true;

  // якщо сектор уже зафіксований після розрахунку — НЕ валідимо його
  if (grp.classList.contains('is-locked')) return true;

  // валідимо тільки ті поля, що не disabled
  const req = grp.querySelectorAll('select:not([disabled]), input[type="number"]:not([disabled])');

  let ok = true;
  req.forEach(el => {
    const empty = (el.tagName === 'SELECT')
      ? (el.selectedIndex <= 0)
      : (String(el.value ?? '').trim() === '');
    el.classList.toggle('is-invalid', empty);
    if (empty) ok = false;
  });
  return ok;
};


    const g1ok = validateGroup(object1Group);
    const g2ok = validateGroup(object2Group);
    if (!g1ok || !g2ok) return; // є порожні поля — не рахуємо

    // === B) Визначаємо поточний режим цієї ж підсекції
    const block = btn.closest('[id^="univers_diameter"], [id^="univers_distance"], [id^="univers_luminosity"], [id^="univers_mass"], [id^="history"], [id^="math"], [id^="money"], [id^="geo"], [id^="other"]');
    if (!block) return;

    // --- ДІАМЕТР ---
    if (block.id.startsWith('univers_diameter')) {
      const data = getDiameterData();
      if (!data) {
        console.warn('❌ Не заповнені всі поля або ще не завантажена бібліотека univers.json.');
        return;
      }

      // 1) задали масштаб за об'єктом 1
        const color1 = getColorForKey(`diam:${data.object1.name || data.object1.libIndex}`);

        setObject1Scale(
          data.object1.diameterReal,
          data.object1.unit,
          data.object1.diameterScaled,
          color1
        );


        // 2) намалювали коло для об'єкта 2 (опціонально)
        const color2 = getColorForKey(`diam:${data.object2.name || data.object2.libIndex}`);

          addObject2Circle(
            data.object2.diameterReal,
            data.object2.unit,
            color2
          );


        // 3) порахували масштабований діаметр кола для О2 (у метрах)
        const scale = getCurrentScale();
        let obj2ScaledMeters = null;
        if (scale && data.object2.diameterReal) {
          const real2m = Number(convertUnit(
            data.object2.diameterReal,
            data.object2.unit,
            'm',
            'diameter'
          ));
          if (isFinite(real2m) && real2m > 0) obj2ScaledMeters = real2m * scale;
        }

        // 4) інфопанель — передай ще name/description
        setBaselineResult({
          libIndex: data.object1.libIndex,
          realValue: data.object1.diameterReal,
          realUnit: data.object1.unit,
          scaledMeters: data.object1.diameterScaled,
          name: data.object1.name,
          description: data.object1.description,
          color: color1
        });

        setCircleLabelText(color1, data.object1.name);

        addResult({
          libIndex: data.object2.libIndex,
          realValue: data.object2.diameterReal,
          realUnit: data.object2.unit,
          scaledMeters: obj2ScaledMeters,
          name: data.object2.name,
          description: data.object2.description,
          color: color2
        });

        setCircleLabelText(color2, data.object2.name);

      // 4) Після успіху: блокуємо сектор 1 і підсвічуємо кнопки в ЦІЙ підсекції
      if (object1Group) {
        object1Group.classList.add('is-locked');
        object1Group.querySelectorAll('select, input, button').forEach(el => { el.disabled = true; });
      }
      if (scope) {
        scope.querySelectorAll('button#calculate').forEach(b => b.classList.add('is-active')); // зелена
        scope.querySelectorAll('button#reset').forEach(b => b.classList.add('is-active'));     // червона
      }

      console.log('✅ Розрахунок діаметра виконано');
      return;
    }

    // --- Інші режими (плейсхолдери) ---
    if (block.id.startsWith('univers_distance'))  console.log('📏 distance: TODO');
    if (block.id.startsWith('univers_luminosity')) console.log('💡 luminosity: TODO');
    if (block.id.startsWith('univers_mass'))       console.log('⚖ mass: TODO');
    if (block.id.startsWith('history'))            console.log('🕰 history: TODO');
    if (block.id.startsWith('math'))               console.log('➗ math: TODO');
    if (block.id.startsWith('money'))              console.log('💰 money: TODO');
    if (block.id.startsWith('geo'))                console.log('🗺 geo: TODO');
    if (block.id.startsWith('other'))              console.log('📦 other: TODO');

    return; // завершили гілку calculate
  }

  // 2) "Скинути"
  if (id === 'reset') {
    resetAllUI();
    console.log('✅ Повний скидання виконано');
    return;
  }
});
// ─────────────────────────────────────────────────────────────
// Делегований обробник для кнопок "Створити" у блоці ДІАМЕТРИ
document.addEventListener('click', async (e) => {
  const btn = e.target;
  if (!(btn instanceof HTMLElement)) return;
  if (btn.id !== 'create') return;

  // Працюємо тільки коли клік всередині блоку "Діаметри"
  const block = btn.closest('#univers_diameter');
  if (!block) return;

  // Визначаємо слот за сектором
  const group = btn.closest('.sector-block');
  let slot = 'object2';
  if (group?.querySelector('#createFirstObject'))  slot = 'object1';
  if (group?.querySelector('#createSecondObject')) slot = 'object2';

  // Підтягуємо попередньо вибрану категорію відповідного слота
  const presetCategoryEl = document.getElementById(
    slot === 'object1' ? 'diamCategoryObject1' : 'diamCategoryObject2'
  );
  const presetCategory = presetCategoryEl && typeof presetCategoryEl.value === 'string'
    ? presetCategoryEl.value
    : '';

  // Відкрити модалку створення
  await openCreateModal({ mode: 'diameter', presetCategory, slot });
});
