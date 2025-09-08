import { t } from '/js/i18n.js';
import { getUserEmail, watchAuth } from '/cabinet/js/cloud/auth.cloud.js';
import { openCabinetSignInDialog } from '/cabinet/js/account.menu.js';

document.addEventListener('DOMContentLoaded', async () => {
  const ribbon = document.getElementById('cabinet-ribbon');
  const globe = document.getElementById('globe-container');
  if (!ribbon || !globe) return;

  ribbon.classList.remove('cabinet-hidden');
  
  // Запобігаємо повторній ініціалізації
  if (ribbon.dataset.inited) return;
  ribbon.dataset.inited = 'true';

  function mkBtn(id, iconPath, i18nKey) {
    const b = document.createElement('button');
    b.id = id;
    b.className = 'ribbon-btn';
    const label = t(i18nKey);
    b.title = label;
    b.setAttribute('aria-label', label);

    const img = document.createElement('img');
    img.className = 'ribbon-icon';
    img.src = iconPath;
    img.alt = label;

    b.appendChild(img);
    return b;
  }

  async function render() {
    // Перевіряємо, чи кнопки вже існують
    const existingSaveBtn = document.getElementById('ribbon-save');
    const existingMineBtn = document.getElementById('ribbon-my');
    
    if (existingSaveBtn && existingMineBtn) {
      return; // Кнопки вже існують - виходимо
    }
    
    // Створюємо нові кнопки
    ribbon.innerHTML = '';
    
    const btnSave = mkBtn('ribbon-save', '/res/icons/save.png', 'ui.topbar.save_scene');
    const btnMine = mkBtn('ribbon-my', '/res/icons/scene.png','ui.topbar.my_scenes');

    // Додаємо обробники подій
    btnSave.addEventListener('click', async () => {
      const isAuthed = !!(await getUserEmail().catch(() => null));
      if (!isAuthed) { 
        openCabinetSignInDialog(); 
        return; 
      }
      document.dispatchEvent(new CustomEvent('cabinet:save-scene'));
    });

    btnMine.addEventListener('click', async () => {
      const isAuthed = !!(await getUserEmail().catch(() => null));
      if (!isAuthed) { 
        openCabinetSignInDialog(); 
        return; 
      }
      document.dispatchEvent(new CustomEvent('cabinet:open-my-scenes'));
    });
    
    ribbon.appendChild(btnSave);
    ribbon.appendChild(btnMine);
  }

  await render();
  watchAuth(render);
});