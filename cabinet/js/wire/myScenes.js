// /cabinet/js/wire/myScenes.js
import { t } from '/js/i18n.js';
import { getUserEmail } from '/cabinet/js/cloud/auth.cloud.js';
import {
  listMine,
  getSceneById,
  ensureShortLink,
  updateScene,
  deleteScene,
} from '/cabinet/js/cloud/scenes.cloud.js';
import { openCabinetSignInDialog } from '/cabinet/js/account.menu.js';

const MODAL_KEY = 'my-scenes';
const EDIT_MODAL_KEY = 'edit-scene';
const CONFIRM_MODAL_KEY = 'confirm-delete';

let escHandlerMain = null;
let escHandlerEdit = null;
let escHandlerConfirm = null;
let currentRows = [];

// --- i18n: без хардкод-фолбеків ---
function tStrict(key) {
  const val = t(key);
  return val && val !== key ? val : '';
}

// --- DOM helpers (без innerHTML) ---
function createEl(tag, className, attrs = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') el.textContent = v ?? '';
    else el.setAttribute(k, v ?? '');
  }
  return el;
}

function clearElement(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

// --- utils ---
function formatDateOnly(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString();
}

function iconBtn({ tipKey, aria, src, onClick }) {
  const btn = createEl('button', 'cab-icon-btn has-tip', {
    type: 'button',
    'aria-label': aria || tStrict(tipKey),
    'data-tip': tStrict(tipKey)   // тільки наш тултіп
  });
  const img = createEl('img', 'cab-icon', { src, alt: '' });
  btn.appendChild(img);
  btn.addEventListener('click', onClick);
  return btn;
}


// --- Main modal lifecycle ---
function closeMainModal() {
  const overlay = document.querySelector(
    `.cab-modal-overlay[data-modal="${MODAL_KEY}"]`,
  );
  if (!overlay) return;
  if (escHandlerMain) document.removeEventListener('keydown', escHandlerMain);
  escHandlerMain = null;
  overlay.remove();
}

function ensureMainModal() {
  let overlay = document.querySelector(
    `.cab-modal-overlay[data-modal="${MODAL_KEY}"]`,
  );
  if (overlay) return overlay;

  overlay = createEl('div', 'cab-modal-overlay', {
    'data-modal': MODAL_KEY,
    role: 'dialog',
    'aria-modal': 'true',
  });

  const modal = createEl('div', 'cab-modal');

  const header = createEl('div', 'cab-modal-header');
  const title = createEl('h3', 'cab-modal-title', {
    text: tStrict('ui.topbar.my_scenes'),
  });
  const closeBtn = createEl('button', 'cab-close-btn', {
    type: 'button',
    'aria-label': 'Close',
    text: '×',
  });
  header.append(title, closeBtn);

  const body = createEl('div', 'cab-modal-body');
  const status = createEl('div', 'cab-status');
  const list = createEl('div', 'cab-scenes-list', { id: 'cab-my-scenes-list' });
  body.append(status, list);

  modal.append(header, body);
  overlay.append(modal);
  document.body.appendChild(overlay);

  const onClose = () => closeMainModal();
  closeBtn.addEventListener('click', onClose);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) onClose();
  });
  escHandlerMain = (e) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', escHandlerMain);

  return overlay;
}

function setStatus(text) {
  const el = document.querySelector(
    `.cab-modal-overlay[data-modal="${MODAL_KEY}"] .cab-status`,
  );
  if (el) el.textContent = text || '';
}

function getListContainer() {
  return document.querySelector('#cab-my-scenes-list');
}

// --- Render ---
function renderEmpty() {
  const list = getListContainer();
  if (!list) return;
  clearElement(list);
  list.appendChild(
    createEl('div', 'cab-empty', { text: tStrict('scenes.empty') }),
  );
}

function renderList(rows) {
  const list = getListContainer();
  if (!list) return;
  clearElement(list);

  rows.forEach((row) => {
    const card = createEl('div', 'cab-scene-card');

    const title = createEl('div', 'cab-scene-title', {
      text: (row.title && row.title.trim()) || tStrict('scenes.untitled'),
    });

    const desc = createEl('div', 'cab-scene-desc', {
      text: (row.description && row.description.trim()) || '',
    });

    const createdDate = formatDateOnly(row.created_at);
    const meta = createEl('div', 'cab-scene-meta', { text: createdDate });

    // actions (іконки з тултіпами)
    const actions = createEl('div', 'cab-scene-actions');

    const btnOpen = iconBtn({
      tipKey: 'scenes.open',
      aria: tStrict('scenes.open'),
      src: '/res/icons/open.png',
      onClick: () => onOpen(row.id),
    });

    const btnShare = iconBtn({
      tipKey: 'scenes.share',
      aria: tStrict('scenes.share'),
      src: '/res/icons/share.png',
      onClick: () => onShare(row.id),
    });

    const btnToggle = iconBtn({
      tipKey: row.is_public ? 'scenes.make_private' : 'scenes.make_public',
      aria: tStrict(row.is_public ? 'scenes.make_private' : 'scenes.make_public'),
      src: row.is_public ? '/res/icons/private.png' : '/res/icons/public.png',
      onClick: () => onToggleVisibility(row, btnToggle),
    });

    const btnEdit = iconBtn({
      tipKey: 'scenes.edit',
      aria: tStrict('scenes.edit'),
      src: '/res/icons/edit.png',
      onClick: () => openEditModal(row),
    });

    const btnDelete = iconBtn({
      tipKey: 'scenes.delete',
      aria: tStrict('scenes.delete'),
      src: '/res/icons/delete.png',
      onClick: () => openDeleteConfirm(row),
    });

    actions.append(btnOpen, btnShare, btnToggle, btnEdit, btnDelete);
    card.append(title, desc, meta, actions);
    list.appendChild(card);
  });
}

// --- Actions (основні) ---
async function onOpen(sceneId) {
  try {
    setStatus('');
    const scene = await getSceneById(sceneId);
    if (!scene || !scene.query) throw new Error('Scene not found');
    if (!window.orbit?.applyScene) throw new Error('Apply engine not found');
    window.orbit.applyScene(scene.query);
  } catch (e) {
    console.error(e);
    setStatus(tStrict('errors.generic'));
  }
}

async function onShare(sceneId) {
  try {
    setStatus('');
    const code = await ensureShortLink(sceneId);
    const url = `${window.location.origin}/?s=${code}`;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const ta = createEl('textarea', '');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setStatus(tStrict('scenes.link_copied'));
  } catch (e) {
    console.error(e);
    setStatus(tStrict('errors.generic'));
  }
}

async function onToggleVisibility(row, btn) {
  const next = !row.is_public;
  try {
    await updateScene(row.id, { is_public: next });
    row.is_public = next;

    btn.setAttribute(
      'data-tip',
      tStrict(next ? 'scenes.make_private' : 'scenes.make_public'),
    );
    btn.setAttribute(
      'title',
      tStrict(next ? 'scenes.make_private' : 'scenes.make_public'),
    );
    btn.setAttribute(
      'aria-label',
      tStrict(next ? 'scenes.make_private' : 'scenes.make_public'),
    );
    const img = btn.querySelector('img.cab-icon');
    if (img) {
      img.setAttribute('src', next ? '/res/icons/private.png' : '/res/icons/public.png');
    }
    setStatus('');
  } catch (e) {
    console.error(e);
    setStatus(tStrict('errors.generic'));
  }
}

// --- Edit modal ---
function closeEditModal() {
  const overlay = document.querySelector(
    `.cab-modal-overlay[data-modal="${EDIT_MODAL_KEY}"]`,
  );
  if (!overlay) return;
  if (escHandlerEdit) document.removeEventListener('keydown', escHandlerEdit);
  escHandlerEdit = null;
  overlay.remove();
}

function openEditModal(row) {
  closeEditModal();

  const overlay = createEl('div', 'cab-modal-overlay', {
    'data-modal': EDIT_MODAL_KEY,
    role: 'dialog',
    'aria-modal': 'true',
  });

  const modal = createEl('div', 'cab-modal');

  const header = createEl('div', 'cab-modal-header');
  const titleH = createEl('h3', 'cab-modal-title', { text: tStrict('scenes.edit') });
  const closeBtn = createEl('button', 'cab-close-btn', {
    type: 'button',
    'aria-label': 'Close',
    text: '×',
  });
  header.append(titleH, closeBtn);

  const body = createEl('div', 'cab-modal-body');
  const form = createEl('form', 'cab-form', {});

  // Title
  const rowTitle = createEl('div', 'cab-form-row');
  const labelTitle = createEl('label', '', { for: 'sc-edit-title', text: tStrict('scenes.field_title') });
  const inputTitle = createEl('input', '', { id: 'sc-edit-title', type: 'text', value: row.title || '' });
  rowTitle.append(labelTitle, inputTitle);

  // Description
  const rowDesc = createEl('div', 'cab-form-row');
  const labelDesc = createEl('label', '', { for: 'sc-edit-desc', text: tStrict('scenes.field_description') });
  const inputDesc = createEl('textarea', '', { id: 'sc-edit-desc' });
  inputDesc.value = row.description || '';
  rowDesc.append(labelDesc, inputDesc);

  // Public
  const rowPublic = createEl('div', 'cab-form-row');
  const labelPub = createEl('label', '', { for: 'sc-edit-public', text: tStrict('scenes.field_public') });
  const inputPub = createEl('input', '', { id: 'sc-edit-public', type: 'checkbox' });
  inputPub.checked = !!row.is_public;
  rowPublic.append(labelPub, inputPub);

  // Actions
  const actions = createEl('div', 'cab-form-actions');
  const btnCancel = createEl('button', 'cab-btn', {
    type: 'button',
    text: tStrict('scenes.cancel'),
  });
  const btnSave = createEl('button', 'cab-btn cab-btn--primary', {
    type: 'submit',
    text: tStrict('scenes.save_changes'),
  });
  actions.append(btnCancel, btnSave);

  form.append(rowTitle, rowDesc, rowPublic, actions);
  body.append(form);

  modal.append(header, body);
  overlay.append(modal);
  document.body.appendChild(overlay);

  const onClose = () => closeEditModal();
  closeBtn.addEventListener('click', onClose);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) onClose(); });
  escHandlerEdit = (e) => { if (e.key === 'Escape') onClose(); };
  document.addEventListener('keydown', escHandlerEdit);

  btnCancel.addEventListener('click', onClose);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSave.disabled = true;

    try {
      const patch = {
        title: (inputTitle.value || '').trim(),
        description: (inputDesc.value || '').trim(),
        is_public: !!inputPub.checked,
      };
      await updateScene(row.id, patch);

      // Оновлюємо локальний об'єкт
      row.title = patch.title;
      row.description = patch.description;
      row.is_public = patch.is_public;

      // Перемальовуємо список
      if (currentRows && currentRows.length) renderList(currentRows);
      setStatus(''); // без зайвих текстів у статусі
      onClose();
    } catch (err) {
      console.error(err);
      // Можна показати локальне попередження у формі, але поки обмежимось статусом у головній модалці
      setStatus(tStrict('errors.generic'));
      btnSave.disabled = false;
    }
  });
}

// --- Delete confirm modal ---
function closeConfirmModal() {
  const overlay = document.querySelector(
    `.cab-modal-overlay[data-modal="${CONFIRM_MODAL_KEY}"]`,
  );
  if (!overlay) return;
  if (escHandlerConfirm) document.removeEventListener('keydown', escHandlerConfirm);
  escHandlerConfirm = null;
  overlay.remove();
}

function openDeleteConfirm(row) {
  closeConfirmModal();

  const overlay = createEl('div', 'cab-modal-overlay', {
    'data-modal': CONFIRM_MODAL_KEY,
    role: 'dialog',
    'aria-modal': 'true',
  });

  const modal = createEl('div', 'cab-modal');

  const header = createEl('div', 'cab-modal-header');
  const titleH = createEl('h3', 'cab-modal-title', { text: tStrict('scenes.confirm_delete_title') });
  const closeBtn = createEl('button', 'cab-close-btn', {
    type: 'button',
    'aria-label': 'Close',
    text: '×',
  });
  header.append(titleH, closeBtn);

  const body = createEl('div', 'cab-modal-body');
  const text = createEl('p', '', { text: tStrict('scenes.confirm_delete_text') });
  const actions = createEl('div', 'cab-form-actions');
  const btnCancel = createEl('button', 'cab-btn', { type: 'button', text: tStrict('scenes.cancel') });
  const btnOk = createEl('button', 'cab-btn cab-btn--primary', { type: 'button', text: tStrict('scenes.confirm') });
  actions.append(btnCancel, btnOk);
  body.append(text, actions);

  modal.append(header, body);
  overlay.append(modal);
  document.body.appendChild(overlay);

  const onClose = () => closeConfirmModal();
  closeBtn.addEventListener('click', onClose);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) onClose(); });
  escHandlerConfirm = (e) => { if (e.key === 'Escape') onClose(); };
  document.addEventListener('keydown', escHandlerConfirm);

  btnCancel.addEventListener('click', onClose);
  btnOk.addEventListener('click', async () => {
    btnOk.disabled = true;
    try {
      await deleteScene(row.id);
      // прибираємо зі списку
      currentRows = (currentRows || []).filter((r) => r.id !== row.id);
      if (!currentRows.length) renderEmpty();
      else renderList(currentRows);
      setStatus('');
      onClose();
    } catch (err) {
      console.error(err);
      setStatus(tStrict('errors.generic'));
      btnOk.disabled = false;
    }
  });
}

// --- Entry ---
async function openMyScenes() {
  const email = await getUserEmail();
  if (!email) {
    openCabinetSignInDialog();
    return;
  }

  ensureMainModal();
  setStatus(tStrict('loading'));

  try {
    currentRows = await listMine({ limit: 50, offset: 0 }); // тільки мої сцени
    setStatus('');
    if (!currentRows || currentRows.length === 0) renderEmpty();
    else renderList(currentRows);
  } catch (e) {
    console.error(e);
    setStatus(tStrict('errors.generic'));
    renderEmpty();
  }
}

document.addEventListener('cabinet:open-my-scenes', openMyScenes);
