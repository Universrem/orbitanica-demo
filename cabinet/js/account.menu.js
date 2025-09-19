// /cabinet/js/account.menu.js
// Прив’язуємо поведінку до #btn-user: поповер із Sign in / Sign out,
// зміна іконки гостя/користувача, невелика модалка для введення email.
// Працює лише через наші cloud-методи; /js/ (режими) не чіпаємо.

import { t } from '/js/i18n.js';
import { signInWithEmail, signOut, getUserEmail, watchAuth } from '/cabinet/js/cloud/auth.cloud.js';
// Експортований відкривач модалки входу (без глобалів/вікон)
export function openCabinetSignInDialog() {
  openSignInModal(async (value, setError, close) => {
    try {
      await signInWithEmail(value);
      close();
    } catch (err) {
      setError(err?.message || t('auth.error.generic'));
    }
  });
}

// ——— Модалка вводу email ———
// Перенесено у верхній рівень модуля, щоб її могли викликати інші модулі через експорт вище
function openSignInModal(onSubmit /* (email, setError, close) */) {
  closeSignInModal();

  const overlay = document.createElement('div');
  overlay.id = 'cab-auth-overlay';
  overlay.className = 'cab-modal-overlay';
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeSignInModal(); });

  const box = document.createElement('div');
  box.className = 'cab-modal';
  box.setAttribute('role','dialog');
  box.setAttribute('aria-modal','true');
  box.setAttribute('aria-label', t('auth.dialog.title'));

  const h = document.createElement('h3');
  h.className = 'cab-modal-title';
  h.textContent = t('auth.dialog.title');

  const input = document.createElement('input');
  input.type = 'email';
  input.className = 'cab-input';
  input.placeholder = t('auth.field.email');

  const hint = document.createElement('div');
  hint.className = 'cab-hint';
  hint.textContent = t('auth.note.sent_body');

  const err = document.createElement('div');
  err.className = 'cab-error';
  err.hidden = true;

  const row = document.createElement('div');
  row.className = 'cab-row';

  const btnCancel = document.createElement('button');
  btnCancel.className = 'cab-btn';
  btnCancel.textContent = t('ui.cancel');
  btnCancel.addEventListener('click', closeSignInModal);

  const btnSend = document.createElement('button');
  btnSend.className = 'cab-btn cab-primary';
  btnSend.textContent = t('auth.button.send_link');

  function setError(msg){ err.textContent = msg || ''; err.hidden = !msg; }
  function close(){ closeSignInModal(); }

  btnSend.addEventListener('click', async () => {
    setError('');
    const val = (input.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setError(t('auth.error.invalid_email'));
      input.focus();
      return;
    }
    btnSend.disabled = true;
    try { await onSubmit(val, setError, close); }
    finally { btnSend.disabled = false; }
  });

  box.appendChild(h);
  box.appendChild(input);
  box.appendChild(hint);
  box.appendChild(err);
  box.appendChild(row);

  row.appendChild(btnCancel);
  row.appendChild(btnSend);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  input.focus();
}

function closeSignInModal() {
  const el = document.getElementById('cab-auth-overlay');
  if (el) el.remove();
}

// Іконки (поклади /res/icons/user-auth.png; гість використовує чинний user.png)
const ICON_GUEST = '/res/icons/user.png';
const ICON_AUTH  = '/res/icons/user-auth.png';
let LAST_AUTHED = false;

function setTip(el, label) {
  if (!el) return;
  el.classList.add('has-tip');
  el.setAttribute('aria-label', label);
  el.setAttribute('data-tip', label);
  el.removeAttribute('title');
}

function refreshTopbarTips(authed) {
  setTip(document.getElementById('btn-blog'),        t('ui.topbar.blog'));
  setTip(document.getElementById('btn-user'),        authed ? t('ui.topbar.sign_out') : t('ui.topbar.sign_in'));
  setTip(document.getElementById('btn-save-scene'),  t('ui.topbar.save_scene'));
  setTip(document.getElementById('btn-my-scenes'),   t('ui.topbar.my_scenes'));
}

// Додавання/видалення кнопок у топбарі (без CSS/hidden)
function renderSignedButtons(isSigned) {
  const rail   = document.getElementById('right-rail');
  const anchor = document.getElementById('lang-menu'); // вставляємо ПЕРЕД мовним меню
  if (!rail || !anchor) return;

  let btnSave = document.getElementById('btn-save-scene');
  let btnMy   = document.getElementById('btn-my-scenes');

  if (isSigned) {
  // ---- SAVE SCENE ----
  if (!btnSave) {
    const labelSave = t('ui.topbar.save_scene') || 'Save scene';
    btnSave = document.createElement('button');
    btnSave.id = 'btn-save-scene';
    btnSave.className = 'top-icon-button has-tip';
    btnSave.setAttribute('aria-label', labelSave);
    btnSave.setAttribute('data-tip', labelSave);

    const img = document.createElement('img');
    img.className = 'top-icon';
    img.src = '/res/icons/save.png';
    img.alt = '';
    btnSave.appendChild(img);

    // діємо так само, як стрічка: кидаємо подію
    btnSave.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('cabinet:save-scene'));
    });
rail.insertBefore(btnSave, anchor);

  }

  // ---- MY SCENES ----
  if (!btnMy) {
    const labelMy = t('ui.topbar.my_scenes') || 'My scenes';
    btnMy = document.createElement('button');
    btnMy.id = 'btn-my-scenes';
    btnMy.className = 'top-icon-button has-tip';
    btnMy.setAttribute('aria-label', labelMy);
    btnMy.setAttribute('data-tip', labelMy);

    const img = document.createElement('img');
    img.className = 'top-icon';
    img.src = '/res/icons/scene.png';
    img.alt = '';
    btnMy.appendChild(img);

    btnMy.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('cabinet:open-my-scenes'));
    });

    rail.insertBefore(btnMy, anchor);
    refreshTopbarTips(true);

  }
} else {
  if (btnSave) btnSave.remove();
  if (btnMy)   btnMy.remove();
  refreshTopbarTips(false);

}

}


document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-user');
  if (!btn) return;

  const img = btn.querySelector('img.top-icon');
  const pop = createPopover();
  positionPopover(btn, pop);
  refreshTopbarTips(false);

  // Початково сховати (гість) — до приходу стану auth
  // старт: гість → кнопок нема
  renderSignedButtons(false);


  // Стартовий стан
  refreshIconAndAria();

  document.addEventListener('languageChanged', () => refreshTopbarTips(LAST_AUTHED));
window.addEventListener('orbit:lang-change', () => refreshTopbarTips(LAST_AUTHED));


  // Живе оновлення при зміні сесії
  watchAuth(() => {
    refreshIconAndAria();
    hide(pop);
  });

  // Відкриття/закриття поповера
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    renderPopover(pop);
    toggle(pop);
    positionPopover(btn, pop);
  });
  document.addEventListener('click', () => hide(pop));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide(pop);
  });

  // ————— helpers —————
  async function refreshIconAndAria() {
  const email = await getUserEmail().catch(() => null);
  const authed = !!email;

  // Іконка
  if (img) img.src = authed ? ICON_AUTH : ICON_GUEST;

  // ARIA + title
  const label = authed ? t('ui.topbar.sign_out') : t('ui.topbar.sign_in');
  btn.setAttribute('aria-label', label);
  LAST_AUTHED = authed;
  refreshTopbarTips(authed);

  btn.removeAttribute('title');           // прибираємо нативний тултіп
btn.classList.add('has-tip');
btn.setAttribute('data-tip', label);    // показуємо наш тултіп


// Топбар-кнопки (Save/My)
renderSignedButtons(authed);


}


  function createPopover() {
    let el = document.getElementById('cab-account-popover');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cab-account-popover';
    el.className = 'cab-popover';
    el.setAttribute('role', 'menu');
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  }

  function positionPopover(anchor, el) {
    const r = anchor.getBoundingClientRect();
    el.style.top  = `${Math.round(r.bottom + window.scrollY + 6)}px`;
    el.style.left = `${Math.round(r.right - 220 + window.scrollX)}px`; // вирівнюємо праворуч
  }

  function toggle(el){ el.hidden = !el.hidden; }
  function hide(el){ el.hidden = true; }

  async function renderPopover(el) {
    el.innerHTML = '';
    const email = await getUserEmail().catch(() => null);

    if (!email) {
      // Sign in
      const b = document.createElement('button');
      b.className = 'cab-item';
      b.setAttribute('role','menuitem');
      b.textContent = t('ui.topbar.sign_in');
b.addEventListener('click', () => {
  hide(el);
  openCabinetSignInDialog();
});

      el.appendChild(b);
    } else {
      // Sign out (email)
      const b = document.createElement('button');
      b.className = 'cab-item';
      b.setAttribute('role','menuitem');
      b.textContent = `${t('ui.topbar.sign_out')} (${email})`;
      b.addEventListener('click', async () => {
        hide(el);
        try { await signOut(); } catch { /* no-op */ }
      });
      el.appendChild(b);
    }
  }

});
