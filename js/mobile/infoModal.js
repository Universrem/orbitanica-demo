// /js/mobile/infoModal.js
'use strict';

import { t } from '../i18n.js';

function isMobile() {
  try {
    return window.matchMedia('(max-width: 768px)').matches;
  } catch {
    return true;
  }
}

function openMobileInfoModal() {
  // Не відкриваємо другу модалку поверх першої
  if (document.querySelector('.mobile-info-modal-overlay')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'mobile-info-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'mobile-info-modal';

  const message = document.createElement('p');
  message.textContent = t('mobile.info_modal.text');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mobile-info-modal-btn';
  btn.textContent = t('center_guide.ok');

  function close() {
    overlay.remove();
  }

  btn.addEventListener('click', () => {
    close();
  });

  // Клік по затемненню — теж закриває
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
    }
  });

  modal.appendChild(message);
  modal.appendChild(btn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function initMobileInfoButton() {
  const btn = document.getElementById('btn-mobile-info');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isMobile()) return; // перестраховка, на десктопі кнопка й так схована
    openMobileInfoModal();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileInfoButton, { once: true });
} else {
  initMobileInfoButton();
}
