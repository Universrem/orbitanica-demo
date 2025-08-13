// full/js/events/create_buttons.js
'use strict';

import { openCreateModal } from '../userObjects/modal.js';

/**
 * Визначаємо, у якому саме блоці працює кнопка "Створити".
 * Поки що обмежуємося тільки блоком ДІАМЕТРИ (id="univers_diameter"),
 * щоб інші розділи з таким самим id="create" не ловили кліки до впровадження.
 */
function getActiveBlockId(btn) {
  // найближчий предок з id починаючи від univers_
  const block = btn.closest('#univers_diameter');
  return block ? 'univers_diameter' : null;
}

/**
 * Визначаємо слот за найближчим контейнером .sector-block:
 * якщо всередині є елемент з id="createFirstObject" → object1,
 * якщо є id="createSecondObject" → object2.
 */
function getSlot(btn) {
  const group = btn.closest('.sector-block');
  if (!group) return 'object2';

  if (group.querySelector('#createFirstObject')) return 'object1';
  if (group.querySelector('#createSecondObject')) return 'object2';

  // запасний варіант для діаметра за наявністю селекторів категорій
  if (group.querySelector('#diamCategoryObject1')) return 'object1';
  if (group.querySelector('#diamCategoryObject2')) return 'object2';

  return 'object2';
}

/**
 * Повертає попередньо вибрану категорію для модалки за слотом.
 */
function getPresetCategory(blockId, slot) {
  if (blockId === 'univers_diameter') {
    const sel = document.getElementById(
      slot === 'object1' ? 'diamCategoryObject1' : 'diamCategoryObject2'
    );
    return sel && typeof sel.value === 'string' ? sel.value : '';
  }
  return '';
}

// Делегований обробник усіх кліків по документу
document.addEventListener('click', async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  // ловимо лише кнопки з id="create"
  if (target.id !== 'create') return;

  // визначаємо активний блок (на першому етапі – тільки ДІАМЕТРИ)
  const blockId = getActiveBlockId(target);
  if (blockId !== 'univers_diameter') return;

  const slot = getSlot(target);
  const presetCategory = getPresetCategory(blockId, slot);

  await openCreateModal({
    mode: 'diameter',
    presetCategory,
    slot
  });

  // Після створення модалка сама згенерує подію 'user-objects-added',
  // а univers_diameter.js оновить обидві випадайки й активує новий об’єкт у потрібному слоті.
});
