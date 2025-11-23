// /js/utils/o1QuickSuggest.js
'use strict';

import { t } from '../i18n.js';
import { getO1ExamplesForMode } from './o1_examples.js';

const fmt = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  if (x === 0) return '0';

  // усе, що >= 1 м, лишаємо як є (без експоненти)
  if (Math.abs(x) >= 1) {
    return x.toString().replace(/\.?0+$/, '');
  }

  // дуже малі значення — до 15 знаків після коми, без зайвих нулів
  return x.toFixed(15).replace(/\.?0+$/, '');
};

function buildPopover() {
  const pop = document.createElement('div');
  pop.className = 'o1qs-popover';
  pop.setAttribute('role', 'listbox');
  pop.style.display = 'none';
  document.body.appendChild(pop);
  return pop;
}

function fillItems(pop, examples, onPick) {
  pop.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'o1qs-list';

  // БЕЗ заголовка — просто опції:
  examples.forEach(e => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'o1qs-item';
    btn.dataset.value = String(e.value_m);
    btn.textContent = t('o1_example_' + e.key) || e.key;
    // pointerdown, щоб не втратити фокус і не зловити blur перед вибором
    btn.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      onPick(parseFloat(btn.dataset.value));
    });
    list.appendChild(btn);
  });

  pop.appendChild(list);
}

function placePopover(pop, inputEl) {
  const r = inputEl.getBoundingClientRect();
  const width = Math.max(240, Math.round(r.width)); // компактна, але читабельна
  const left = r.right + 8;                          // ВПРАВОРУЧ від поля
  let clampedLeft = left;
  if (left + width > window.innerWidth - 8) {
    clampedLeft = Math.max(8, window.innerWidth - 8 - width);
  }
  pop.style.position = 'fixed';
  pop.style.left = `${Math.round(clampedLeft)}px`;
  pop.style.top  = `${Math.round(r.top)}px`;        // вирівнюємо по верху поля
  pop.style.width = `${width}px`;
  pop.style.zIndex = '10020';
}

/**
 * Підключити popover-підказки до поля O1 (без зміни DOM поля)
 * @param {{inputEl: HTMLElement, modeId?: string}} param0
 * @returns {{destroy: Function}|null}
 */
export function attachO1QuickSuggest({ inputEl, modeId } = {}) {
  if (!inputEl || !(inputEl instanceof HTMLElement)) return null;
  if (inputEl.dataset.o1qsAttached === '1') return null;

  const pop = buildPopover();

  const hide = () => { pop.style.display = 'none'; };
  const show = () => {
    const examples = getO1ExamplesForMode(modeId);
    fillItems(pop, examples, val => {
      if (!Number.isNaN(val)) {
        inputEl.value = fmt(val);
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      hide();
      inputEl.focus();
    });
    placePopover(pop, inputEl);
    pop.style.display = 'block';
  };

  // Показувати на фокус або клік по полі
  const onFocus = () => show();
  const onClick = () => show();
  inputEl.addEventListener('focus', onFocus);
  inputEl.addEventListener('click', onClick);

  // Ховати, якщо користувач починає ВВОДИТИ вручну
  const onType = () => hide();
  inputEl.addEventListener('input', onType);

  // Клік/тап ПОЗА поповером — ховаємо.
  // Використовуємо pointerdown і перевіряємо координати, щоб скролбар всередині поповера НЕ закривав його.
  const onDocPointerDown = (e) => {
    const r = pop.getBoundingClientRect();
    const x = e.clientX, y = e.clientY;
    const inside =
      x >= r.left && x <= r.right &&
      y >= r.top  && y <= r.bottom;
    if (inside) return;                 // клік у межах поповера — не ховаємо
    if (e.target === inputEl) return;   // клік по самому полі — не ховаємо (show() вже зробить)
    hide();
  };
  document.addEventListener('pointerdown', onDocPointerDown);

  // Escape — ховаємо
  const onKey = (e) => { if (e.key === 'Escape') hide(); };
  document.addEventListener('keydown', onKey);

  // Скрол сторінки / ресайз — НЕ ховаємо, а репозиціонуємо (щоб не дратувало)
  const onScroll = () => { if (pop.style.display === 'block') placePopover(pop, inputEl); };
  const onResize = () => { if (pop.style.display === 'block') placePopover(pop, inputEl); };
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('resize', onResize);

  // Зміна мови — перебудувати, залишивши поповер на місці
  const onLang = () => {
    if (pop.style.display === 'block') {
      const examples = getO1ExamplesForMode(modeId);
      fillItems(pop, examples, val => {
        if (!Number.isNaN(val)) {
          inputEl.value = fmt(val);
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        hide();
        inputEl.focus();
      });
      placePopover(pop, inputEl);
    }
  };
  window.addEventListener('languageChanged', onLang);

  inputEl.dataset.o1qsAttached = '1';

  return {
    destroy() {
      try {
        inputEl.removeEventListener('focus', onFocus);
        inputEl.removeEventListener('click', onClick);
        inputEl.removeEventListener('input', onType);
        document.removeEventListener('pointerdown', onDocPointerDown);
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('scroll', onScroll, { capture: true });
        window.removeEventListener('resize', onResize);
        window.removeEventListener('languageChanged', onLang);
        pop.remove();
      } finally {
        delete inputEl.dataset.o1qsAttached;
      }
    }
  };
}
