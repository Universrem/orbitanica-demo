// /cabinet/js/ribbon/ribbon.js
import { t } from '/js/i18n.js';
import { getUserEmail, watchAuth } from '/cabinet/js/cloud/auth.cloud.js';
import { openCabinetSignInDialog } from '/cabinet/js/account.menu.js';

document.addEventListener('DOMContentLoaded', async () => {
  const ribbon = document.getElementById('cabinet-ribbon');
  const globe = document.getElementById('globe-container');
  if (!ribbon || !globe) return;

  ribbon.classList.remove('cabinet-hidden');

  // Уникаємо повторної ініціалізації
  if (ribbon.dataset.inited) return;
  ribbon.dataset.inited = 'true';

  function mkBtn(id, iconPath, i18nKey) {
    const b = document.createElement('button');
    b.id = id;
    b.className = 'ribbon-btn has-tip';
    const label = t(i18nKey);

    // Підказка — лише через aria-label (кастомний тултіп), без title
    b.removeAttribute('title');
    b.setAttribute('aria-label', label);
    b.dataset.tipSide = 'bottom';

    const img = document.createElement('img');
    img.className = 'ribbon-icon';
    img.src = iconPath;           // зберігаємо існуючі імена іконок
    img.alt = label;

    b.appendChild(img);
    return b;
  }

  // Оновлює тексти підказок і alt за поточною мовою
  function refreshLabels() {
    const saveBtn = document.getElementById('ribbon-save');
    const myBtn   = document.getElementById('ribbon-my');

    if (saveBtn) {
      const l = t('ui.topbar.save_scene');
      saveBtn.setAttribute('aria-label', l);
      const img = saveBtn.querySelector('img.ribbon-icon');
      if (img) img.alt = l;
    }
    if (myBtn) {
      const l = t('ui.topbar.my_scenes');
      myBtn.setAttribute('aria-label', l);
      const img = myBtn.querySelector('img.ribbon-icon');
      if (img) img.alt = l;
    }
  }

  async function render() {
    const existingSaveBtn = document.getElementById('ribbon-save');
    const existingMineBtn = document.getElementById('ribbon-my');

    if (existingSaveBtn && existingMineBtn) {
      // Якщо вже є — просто оновимо мітки під нову мову
      refreshLabels();
      return;
    }

    // Створюємо кнопки з нуля
    ribbon.innerHTML = '';

    const btnSave = mkBtn('ribbon-save', '/res/icons/save.png',  'ui.topbar.save_scene');
    const btnMine = mkBtn('ribbon-my',   '/res/icons/scene.png', 'ui.topbar.my_scenes');

    // Обробники подій
    btnSave.addEventListener('click', async () => {
      const isAuthed = !!(await safeGetEmail());
      if (!isAuthed) { openCabinetSignInDialog?.(); return; }
      document.dispatchEvent(new CustomEvent('cabinet:save-scene'));
    });

    btnMine.addEventListener('click', async () => {
      const isAuthed = !!(await safeGetEmail());
      if (!isAuthed) { openCabinetSignInDialog?.(); return; }
      document.dispatchEvent(new CustomEvent('cabinet:open-my-scenes'));
    });

    ribbon.appendChild(btnSave);
    ribbon.appendChild(btnMine);

    // Після створення — синхронізуємо тексти
    refreshLabels();
  }

  await render();

  // Перемальовуємо на зміну авторизації (без дубля слухачів)
  watchAuth(render);

  // --- ПІДПИСКИ НА ЗМІНУ МОВИ ---
  // i18n.js шле ці події:
  // 1) document: 'languageChanged'
  // 2) window:   'orbit:lang-change'  (detail: { lang })
  document.addEventListener('languageChanged', () => {
    refreshLabels();
  });
  window.addEventListener('orbit:lang-change', () => {
    refreshLabels();
  });

  // Наш резервний гачок (можна викликати будь-де після перемикання мови):
  // window.dispatchEvent(new CustomEvent('orbitanica:ribbon:refresh'))
  window.addEventListener('orbitanica:ribbon:refresh', refreshLabels);

  // Якщо є селект мов (#lang-select) — оновимося по його change (необов’язково)
  const langSelect = document.getElementById('lang-select');
  if (langSelect) langSelect.addEventListener('change', refreshLabels);

});

async function safeGetEmail() {
  try {
    return await getUserEmail();
  } catch {
    return null;
  }
}
