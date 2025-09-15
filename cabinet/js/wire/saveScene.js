// /cabinet/js/wire/saveScene.js
// Універсальний місток: UI → БД. ЖОДНИХ режимів всередині.
// Режими під’єднуються окремими файлами через window.orbit.registerSceneSerializer(mode, fn).

import { createScene, ensureShortLink } from '/cabinet/js/cloud/scenes.cloud.js';
import { getSupabase } from '/cabinet/js/cloud/config.js';
import { t, getCurrentLang } from '/js/i18n.js';

// ---------- Публічний реєстр серіалізаторів режимів ----------
(function exposeSerializerRegistry(){
  const serializers = Object.create(null);
  const api = {
    registerSceneSerializer(mode, fn) {
      if (typeof mode === 'string' && typeof fn === 'function') {
        serializers[mode] = fn;
      }
    },
    _get(mode) { return serializers[mode] || null; }
  };
  // Глобальний простір orbit — лише для реєстрації (мінімальний API)
  window.orbit = window.orbit || {};
  window.orbit.registerSceneSerializer = api.registerSceneSerializer;
  // Обробляємо серіалізатори, що могли завантажитися раніше за місток
if (Array.isArray(window.__orbit_pending_serializers__)) {
  for (const s of window.__orbit_pending_serializers__) {
    if (s && typeof s.mode === 'string' && typeof s.fn === 'function') {
      api.registerSceneSerializer(s.mode, s.fn);
    }
  }
  window.__orbit_pending_serializers__ = [];
}

  // Локально збережемо для містка
  window.__orbit_serializer_registry__ = api;
})();

// ---------- Утиліти модалок ----------
function closeModalById(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function openInfoModal(titleText, bodyText) {
  closeModalById('cab-info-overlay');

  const overlay = document.createElement('div');
  overlay.id = 'cab-info-overlay';
  overlay.className = 'cab-modal-overlay';
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeModalById('cab-info-overlay'); });

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
  btnClose.textContent = t('cab_save_btn_close');
  btnClose.addEventListener('click', ()=> closeModalById('cab-info-overlay'));

  actions.appendChild(btnClose);
  box.appendChild(h);
  box.appendChild(p);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function openSaveSceneModal(onSubmit /* (formValues, setError, close) */) {
  closeModalById('cab-save-overlay');

  const overlay = document.createElement('div');
  overlay.id = 'cab-save-overlay';
  overlay.className = 'cab-modal-overlay';
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeModalById('cab-save-overlay'); });

  const box = document.createElement('div');
  box.className = 'cab-modal';
  box.setAttribute('role','dialog');
  box.setAttribute('aria-modal','true');
  box.setAttribute('aria-label', t('cab_save_title'));

  const h = document.createElement('h3');
  h.className = 'cab-modal-title';
  h.textContent = t('cab_save_title');

  const form = document.createElement('form');
  form.className = 'cab-form';

  const rowTitle = document.createElement('div');
  rowTitle.className = 'cab-row';
  const labelTitle = document.createElement('label');
  labelTitle.className = 'cab-label';
  labelTitle.textContent = t('cab_save_field_title');
  const inputTitle = document.createElement('input');
  inputTitle.className = 'cab-input';
  inputTitle.type = 'text';
  inputTitle.placeholder = '...';
  inputTitle.required = true;

  const rowDesc = document.createElement('div');
  rowDesc.className = 'cab-row';
  const labelDesc = document.createElement('label');
  labelDesc.className = 'cab-label';
  labelDesc.textContent = t('cab_save_field_desc');
  const inputDesc = document.createElement('textarea');
  inputDesc.className = 'cab-input';
  inputDesc.rows = 3;
  inputDesc.placeholder = '...';

  const rowPublic = document.createElement('div');
  rowPublic.className = 'cab-row';
  const labelPublic = document.createElement('label');
  labelPublic.className = 'cab-label';
  labelPublic.textContent = t('cab_save_field_public');
  const inputPublic = document.createElement('input');
  inputPublic.type = 'checkbox';
  inputPublic.className = 'cab-checkbox';

  const err = document.createElement('div');
  err.className = 'cab-error';
  err.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'cab-actions';

  const btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'cab-btn';
  btnCancel.textContent = t('cab_save_btn_cancel');
  btnCancel.addEventListener('click', ()=> closeModalById('cab-save-overlay'));

  const btnOk = document.createElement('button');
  btnOk.type = 'submit';
  btnOk.className = 'cab-btn cab-btn-primary';
  btnOk.textContent = t('cab_save_btn_save');

  actions.appendChild(btnCancel);
  actions.appendChild(btnOk);

  rowTitle.appendChild(labelTitle); rowTitle.appendChild(inputTitle);
  rowDesc.appendChild(labelDesc);   rowDesc.appendChild(inputDesc);
  rowPublic.appendChild(labelPublic); rowPublic.appendChild(inputPublic);

  form.appendChild(rowTitle);
  form.appendChild(rowDesc);
  form.appendChild(rowPublic);
  form.appendChild(err);
  form.appendChild(actions);

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    err.hidden = true; err.textContent = '';
    const title = (inputTitle.value || '').trim();
    if (!title) {
      err.hidden = false; err.textContent = t('cab_save_error_need_title');
      return;
    }
    const values = {
      title,
      description: (inputDesc.value || '').trim() || null,
      is_public: !!inputPublic.checked
    };
    btnOk.disabled = true;
    btnOk.textContent = t('cab_save_progress');

    const setError = (message) => { err.hidden = false; err.textContent = message || 'Error'; };
    const close = ()=> closeModalById('cab-save-overlay');

    try {
      await onSubmit(values, setError, close);
    } finally {
      btnOk.disabled = false;
      btnOk.textContent = t('cab_save_btn_save');
    }
  });

  box.appendChild(h);
  box.appendChild(form);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  inputTitle.focus();
}

// ---------- Дрібні утиліти ----------
function getActiveModeId() {
  const left = document.getElementById('left-panel');
  const top = left?.querySelector(':scope > details[open]')
           || document.querySelector('#left-panel > details[open]');
  if (!top) return null;

  // якщо це контейнер (univers/geo) і є відкритий підрежим — беремо його id
  const sub = top.querySelector(':scope > .section-content > details[open]');
  return (sub?.id) || top.id || null;
}


// ---------- Провід: обробка «Save scene» ----------
async function handleSaveScene() {
  try {
    const sb = await getSupabase();
    const { data: userInfo } = await sb.auth.getUser();
    if (!userInfo?.user) return; // вхід показує ribbon.js; тут лише захист від гонки

    const activeMode = getActiveModeId();
    const reg = window.__orbit_serializer_registry__;
    const serialize = activeMode ? reg?._get(activeMode) : null;

    if (!serialize) {
      openInfoModal(t('cab_save_not_supported_title'), t('cab_save_not_supported_body'));
      return;
    }

    const payload = serialize();
    if (!payload || !payload.mode) {
      openInfoModal(t('cab_save_not_supported_title'), t('cab_save_not_supported_body'));
      return;
    }

    openSaveSceneModal(async (formValues, setError, close) => {
      try {
        const sceneRow = {
          title: formValues.title,
          description: formValues.description,
          is_public: formValues.is_public,
          lang: payload.lang || getCurrentLang(),
          mode: payload.mode,
          query: payload
        };
        const id = await createScene(sceneRow);
        const code = await ensureShortLink(id);

        // Екран «збережено»
        const box = document.querySelector('#cab-save-overlay .cab-modal');
        if (box) {
          box.innerHTML = '';
          const h = document.createElement('h3');
          h.className = 'cab-modal-title';
          h.textContent = t('cab_save_done_title');

          const p = document.createElement('p');
          p.className = 'cab-hint';
          p.textContent = t('cab_save_done_hint');

          const copyRow = document.createElement('div');
          copyRow.className = 'cab-row';

          const input = document.createElement('input');
          input.className = 'cab-input';
          input.type = 'text';
          const shortHref = location.origin
            + (location.hostname === 'localhost' ? '/?s=' : '/s/')
            + code;

          input.value = shortHref;
          input.readOnly = true;

          const actions = document.createElement('div');
          actions.className = 'cab-actions';

          const btnCopy = document.createElement('button');
          btnCopy.className = 'cab-btn cab-btn-primary';
          btnCopy.textContent = t('cab_save_btn_copy');
          btnCopy.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(input.value);
              btnCopy.textContent = t('cab_save_btn_copied');
              setTimeout(()=> btnCopy.textContent=t('cab_save_btn_copy'), 1200);
            } catch (_) {}
          });

          const btnClose = document.createElement('button');
          btnClose.className = 'cab-btn';
          btnClose.textContent = t('cab_save_btn_close');
          btnClose.addEventListener('click', ()=> closeModalById('cab-save-overlay'));

          copyRow.appendChild(input);
          actions.appendChild(btnClose);
          actions.appendChild(btnCopy);

          box.appendChild(h);
          box.appendChild(p);
          box.appendChild(copyRow);
          box.appendChild(actions);
        } else {
          close();
        }
      } catch (err) {
        console.error('[SaveScene] Failed:', err);
        setError(err?.message || 'Error');
      }
    });
  } catch (e) {
    console.error('[SaveScene] Unhandled:', e);
  }
}

document.addEventListener('cabinet:save-scene', handleSaveScene);
