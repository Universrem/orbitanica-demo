// /cabinet/js/wire/openShortLink.js
// Автозавантаження сцени за кодом із URL: підтримує '/?s=CODE' і '/s/CODE'.
// Для сторінки без SPA-роутера (localhost) краще користуватися '?s='.

import { getSceneByCode } from '/cabinet/js/cloud/scenes.cloud.js';
import { t } from '/js/i18n.js';

// невелика модалка під стиль кабінету (локальна копія)
function openInfoModal(titleText, bodyText) {
  const id = 'cab-info-overlay';
  document.getElementById(id)?.remove();

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'cab-modal-overlay';
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) overlay.remove(); });

  const box = document.createElement('div');
  box.className = 'cab-modal';
  box.setAttribute('role','dialog');
  box.setAttribute('aria-modal','true');
  box.setAttribute('aria-label', titleText || '');

  const h = document.createElement('h3');
  h.className = 'cab-modal-title';
  h.textContent = titleText || '';

  const p = document.createElement('p');
  p.className = 'cab-hint';
  p.textContent = bodyText || '';

  const actions = document.createElement('div');
  actions.className = 'cab-actions';

  const btnClose = document.createElement('button');
  btnClose.className = 'cab-btn';
  btnClose.textContent = t('cab_save_btn_close') || 'Close';
  btnClose.addEventListener('click', ()=> overlay.remove());

  actions.appendChild(btnClose);
  box.appendChild(h);
  box.appendChild(p);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function readShortCodeFromUrl() {
  const url = new URL(location.href);
  const fromQuery = url.searchParams.get('s');
  if (fromQuery) return fromQuery.trim();

  const path = location.pathname || '';
  if (path.startsWith('/s/')) {
    return path.slice(3).split('/')[0].trim();
  }
  return null;
}

// Невеличкі хелпери застосування до режиму «history»
function setSelectValue(id, value, label) {
  if (!value) return;
  const sel = document.getElementById(id);
  if (!sel || sel.tagName !== 'SELECT') return;
  // якщо опції немає — додамо з підписом
  if (![...sel.options].some(o => String(o.value) === String(value))) {
    const opt = document.createElement('option');
    opt.value = String(value);
    opt.textContent = label || String(value);
    sel.appendChild(opt);
  }
  sel.value = String(value);
}

function setNumberInput(id, n) {
  if (n == null) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.value = String(n);
}

async function bootstrap() {
  const code = readShortCodeFromUrl();
  if (!code) return; // нічого вантажити

  try {
    const scene = await getSceneByCode(code); // JOIN короткого коду → сцена :contentReference[oaicite:3]{index=3}
    if (!scene) {
      openInfoModal('404', t('cab_save_not_supported_body') || 'Scene not found or not public.');
      return;
    }

    // Дамо шанс іншим частинам UI підхопити подію
    document.dispatchEvent(new CustomEvent('cabinet:scene-loaded', { detail: { scene, code } }));

    // Мінімальне застосування для режиму «history» (заповнюємо форму)
    if (scene.mode === 'history' && scene.query?.history) {
      const panel = document.getElementById('history');
      if (panel && 'open' in panel) panel.open = true;

      const h = scene.query.history;
      setSelectValue('histCategoryObject1', h.o1?.categoryKey, h.o1?.categoryKey);
      setSelectValue('histObject1',         h.o1?.objectId,   h.o1?.name);
      setNumberInput('historyBaselineDiameter', h.o1?.baselineDiameterMeters);

      setSelectValue('histCategoryObject2', h.o2?.categoryKey, h.o2?.categoryKey);
      setSelectValue('histObject2',         h.o2?.objectId,   h.o2?.name);
    }

    // Приберемо '?s=' із адресного рядка, щоб не заважав далі
    const url = new URL(location.href);
    if (url.searchParams.has('s')) {
      url.searchParams.delete('s');
      history.replaceState({}, '', url);
    }
  } catch (e) {
    console.error('[openShortLink] failed:', e);
    openInfoModal('Error', e?.message || 'Failed to open the scene.');
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
