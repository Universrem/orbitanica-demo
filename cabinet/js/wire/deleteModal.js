// /cabinet/js/wire/deleteModal.js
// Уніфікована модалка підтвердження видалення (сцени/об’єкти).
// Без кнопки "×" у хедері. Закриття: "Скасувати", Esc, клік поза модалкою.
// API: openDeleteModal({ messageKey, displayName, titleKey?, confirmKey?, cancelKey? }) -> Promise<boolean>

import { t } from '/js/i18n.js';

function fmt(str, vars = {}) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? '' : String(v);
  });
}

function createModal({ titleText, messageText, confirmLabel, cancelLabel }) {
  const overlay = document.createElement('div');
  overlay.className = 'cab-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'cab-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'cab-modal-header';

  const title = document.createElement('h3');
  title.className = 'cab-modal-title';
  title.textContent = titleText;

  const body = document.createElement('div');
  body.className = 'cab-modal-body';

  const msg = document.createElement('p');
  msg.className = 'cab-modal-message';
  msg.textContent = messageText;

  const actions = document.createElement('div');
  actions.className = 'cab-form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cab-btn';
  cancelBtn.textContent = cancelLabel;
  cancelBtn.setAttribute('aria-label', cancelLabel);

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'cab-btn cab-btn--primary';
  confirmBtn.textContent = confirmLabel;
  confirmBtn.setAttribute('aria-label', confirmLabel);

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);

  body.appendChild(msg);
  header.appendChild(title);
  modal.append(header, body, actions);
  overlay.appendChild(modal);

  return { overlay, modal, cancelBtn, confirmBtn };
}

function trapFocus(container, initialEl) {
  const selector = [
    'button',
    '[href]',
    'input',
    'select',
    'textarea',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const getFocusable = () =>
    Array.from(container.querySelectorAll(selector))
      .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

  function onKeydown(e) {
    if (e.key !== 'Tab') return;
    const list = getFocusable();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  container.addEventListener('keydown', onKeydown);
  queueMicrotask(() => initialEl?.focus?.());

  return () => container.removeEventListener('keydown', onKeydown);
}

/**
 * @param {Object} opts
 * @param {string} opts.messageKey - ключ повідомлення з плейсхолдером {name}
 * @param {string} opts.displayName - уже підготовлена назва (мовою інтерфейсу)
 * @param {string} [opts.titleKey='confirm.title']
 * @param {string} [opts.confirmKey='scenes.delete']
 * @param {string} [opts.cancelKey='scenes.cancel']
 * @returns {Promise<boolean>}
 */
export function openDeleteModal(opts = {}) {
  const {
    messageKey,
    displayName,
    titleKey = 'confirm.title',
    confirmKey = 'scenes.delete',
    cancelKey = 'scenes.cancel',
  } = opts;

  const titleText = t(titleKey);
  const messageText = fmt(t(messageKey), { name: displayName });
  const confirmLabel = t(confirmKey);
  const cancelLabel = t(cancelKey);

  return new Promise((resolve) => {
    const { overlay, modal, cancelBtn, confirmBtn } =
      createModal({ titleText, messageText, confirmLabel, cancelLabel });

    function cleanup(result) {
      document.removeEventListener('keydown', onKeyEscEnter, true);
      overlay.removeEventListener('click', onOverlayClick);
      overlay.remove();
      resolve(result);
    }

    function onOverlayClick(e) {
      if (e.target === overlay) cleanup(false);
    }

    function onKeyEscEnter(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cleanup(false);
      } else if (e.key === 'Enter') {
        if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
        cleanup(true);
      }
    }

    const releaseTrap = trapFocus(modal, confirmBtn);

    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyEscEnter, true);

    overlay.addEventListener('remove', () => {
      releaseTrap?.();
    });

    document.body.appendChild(overlay);
  });
}

export default openDeleteModal;
