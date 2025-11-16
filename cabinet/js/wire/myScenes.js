// /cabinet/js/wire/myScenes.js
import { t, getCurrentLang } from '/js/i18n.js';
import { getUserEmail } from '/cabinet/js/cloud/auth.cloud.js';
import {
  listMine,
  getSceneById,
  ensureShortLink,
  updateScene,
  deleteScene,
} from '/cabinet/js/cloud/scenes.cloud.js';
import { openCabinetSignInDialog } from '/cabinet/js/account.menu.js';
import { openDeleteModal } from '/cabinet/js/wire/deleteModal.js';

const MODAL_KEY = 'my-scenes';
const EDIT_MODAL_KEY = 'edit-scene';

let escHandlerMain = null;
let escHandlerEdit = null;
let currentRows = [];
let currentEdit = null;

function modeLine(mode) {
  const raw = String(mode || '').toLowerCase();
  const m = raw.startsWith('univers_') ? raw.slice(8) : raw; // univers_distance -> distance

  // === Geography: підрежими (population/objects/area) ===
  if (m === 'geo_population' || m === 'geo_objects' || m === 'geo_area') {
    const top = tStrict('panel_title_geo');
    const sub = tStrict(`panel_title_geo_${m.split('_')[1]}`); // population / objects / area
    return top && sub ? `${top}: ${sub}` : (top || sub || raw || '');
  }

  // === Universe: підрежими (distance/diameter/mass/luminosity) — так само, як вище ===
  const uni = ['distance','diameter','mass','luminosity'];
  if (uni.includes(m)) {
    const top = tStrict('panel_title_unvers') || tStrict('panel_title_univers'); // про всяк випадок
    const sub = tStrict(`panel_title_univers_${m}`);
    return top && sub ? `${top}: ${sub}` : (top || sub || raw || '');
  }

  // === Однорівневі режими ===
  if (m === 'money')   return tStrict('panel_title_money','Money');
  if (m === 'math')    return tStrict('panel_title_math','Math');
  if (m === 'history') return tStrict('panel_title_history','History');

  return raw || '';
}


// Витяг mode із сцени (пряме поле, payload-об’єкт, JSON, або URL-параметри)
function getSceneMode(row) {
  if (row && typeof row.mode === 'string') return row.mode;
  if (row && row.query && typeof row.query === 'object' && typeof row.query.mode === 'string') return row.query.mode;
  if (row && typeof row.query === 'string') {
    try { const o = JSON.parse(row.query); if (o && typeof o.mode === 'string') return o.mode; } catch {}
    try {
      const u = new URL(row.query, location.origin);
      const m = u.searchParams.get('m') || u.searchParams.get('mode');
      if (m) return m;
    } catch {}
  }
  return '';
}

// --- toast: показ короткого повідомлення поверх сторінки ---
function showCabToast(msgKey = 'scenes.link_copied') {
  const text = tStrict(msgKey);
  if (!text) return;

  let root = document.getElementById('cab-toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'cab-toast-root';
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className = 'cab-toast';
  el.textContent = text;
  el.setAttribute('role','status');
  el.setAttribute('aria-live','polite');
  root.appendChild(el);

  // старт анімації
  void el.offsetWidth;
  el.classList.add('show');

  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, 1600);
}


// --- i18n: без хардкод-фолбеків ---
function tStrict(key) {
  const val = t(key);
  return val && val !== key ? val : '';
}

// --- мови сцен: ua/en/es, вибір поточної та fallback ---
const SCENE_LANGS = ['ua', 'en', 'es'];

function validateSceneLang(l) {
  const v = (l || '').toString().toLowerCase();
  return SCENE_LANGS.includes(v) ? v : 'ua';
}

function currSceneLang() {
  try {
    if (typeof getCurrentLang === 'function') {
      return validateSceneLang(getCurrentLang());
    }
  } catch {}
  return 'ua';
}

// порядок мов: спочатку поточна, потім інші
function sceneLangsOrder(L) {
  const base = validateSceneLang(L || currSceneLang());
  return [base, ...SCENE_LANGS.filter((x) => x !== base)];
}

const trim = (v) => (v == null ? '' : String(v).trim());

function pickSceneI18n(row, base, L = currSceneLang()) {
  const order = sceneLangsOrder(L);

  const direct = trim(row && row[`${base}_${order[0]}`]);
  if (direct) return direct;

  for (let i = 1; i < order.length; i++) {
    const via = trim(row && row[`${base}_${order[i]}`]);
    if (via) return via;
  }

  return trim(row && row[base]) || '';
}

function titleOf(row, L = currSceneLang()) {
  return pickSceneI18n(row, 'title', L) || tStrict('scenes.untitled');
}

function descOf(row, L = currSceneLang()) {
  return pickSceneI18n(row, 'description', L);
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
const rowsSorted = [...rows].sort((a, b) => {
  const ad = new Date(a.created_at || a.updated_at || 0).getTime();
  const bd = new Date(b.created_at || b.updated_at || 0).getTime();
  return ad - bd; // 1 — найстарший
});

  rowsSorted.forEach((row, idx) => {
    const card = createEl('div', 'cab-scene-card');

    // Верхній рядок «Режим:підрежим»
const topModeEl = createEl('div','cab-scene-meta',{ text: modeLine(getSceneMode(row)) });


    const titleText = titleOf(row);
const title = createEl('div', 'cab-scene-title', {
  text: `${idx + 1}. ${titleText}`,
});


    const descText = descOf(row);
    const desc = createEl('div', 'cab-scene-desc', {
      text: descText,
    });

    const dateIso = row.created_at || row.updated_at;
const createdDate = formatDateOnly(dateIso);

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
  onClick: async () => {
    const ok = await openDeleteModal({
      messageKey: 'confirm.delete.scene',
      displayName: titleOf(row),
    });
    if (!ok) return;

    try {
      await deleteScene(row.id);
      currentRows = (currentRows || []).filter(r => r.id !== row.id);
      if (!currentRows.length) renderEmpty(); else renderList(currentRows);
      setStatus('');
    } catch (err) {
      console.error(err);
      setStatus(tStrict('errors.generic'));
    }
  },
});


    actions.append(btnOpen, btnShare, btnToggle, btnEdit, btnDelete);
    card.append(topModeEl, title, desc, meta, actions);
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
      showCabToast('scenes.link_copied');
    } else {
      const ta = createEl('textarea', '');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      showCabToast('scenes.link_copied');
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

  currentEdit = null;

  overlay.remove();

}

function openEditModal(row) {
  closeEditModal();
  currentEdit = row;

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

  // Мова перекладу
  const rowLang = createEl('div', 'cab-form-row');
  const labelLang = createEl('label', '', {
    for: 'sc-edit-lang',
    text: tStrict('scenes.field_lang') || 'Мова',
  });
  const selectLang = createEl('select', '', { id: 'sc-edit-lang' });
  SCENE_LANGS.forEach((code) => {
    const opt = createEl('option', '', {
      value: code,
      text: code.toUpperCase(),
    });
    selectLang.appendChild(opt);
  });
  rowLang.append(labelLang, selectLang);

  // Title
  const rowTitle = createEl('div', 'cab-form-row');
  const labelTitle = createEl('label', '', {
    for: 'sc-edit-title',
    text: tStrict('scenes.field_title'),
  });
  const inputTitle = createEl('input', '', {
    id: 'sc-edit-title',
    type: 'text',
  });
  rowTitle.append(labelTitle, inputTitle);

  // Description
  const rowDesc = createEl('div', 'cab-form-row');
  const labelDesc = createEl('label', '', {
    for: 'sc-edit-desc',
    text: tStrict('scenes.field_description'),
  });
  const inputDesc = createEl('textarea', '', { id: 'sc-edit-desc' });
  rowDesc.append(labelDesc, inputDesc);

  // Public
  const rowPublic = createEl('div', 'cab-form-row');
  const labelPub = createEl('label', '', {
    for: 'sc-edit-public',
    text: tStrict('scenes.field_public'),
  });
  const inputPub = createEl('input', '', {
    id: 'sc-edit-public',
    type: 'checkbox',
  });
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

  form.append(rowLang, rowTitle, rowDesc, rowPublic, actions);
  body.append(form);

  modal.append(header, body);
  overlay.append(modal);
  document.body.appendChild(overlay);

  const onClose = () => closeEditModal();
  closeBtn.addEventListener('click', onClose);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) onClose();
  });
  escHandlerEdit = (e) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', escHandlerEdit);

  btnCancel.addEventListener('click', onClose);

  // Локальний стан перекладів
  const baseLang = validateSceneLang(row.lang || '');
  const fields = {};
  SCENE_LANGS.forEach((code) => {
    const titleKey = `title_${code}`;
    const descKey = `description_${code}`;
    const baseTitle = trim(row && row.title);
    const baseDesc = trim(row && row.description);
    const perTitle = trim(row && row[titleKey]);
    const perDesc = trim(row && row[descKey]);
    const title = perTitle || (baseLang === code ? baseTitle : '');
    const description = perDesc || (baseLang === code ? baseDesc : '');
    fields[code] = { title, description };
  });

  let activeLang = currSceneLang();
  if (!SCENE_LANGS.includes(activeLang)) activeLang = 'ua';

  function applyActiveLang() {
    const f = fields[activeLang] || { title: '', description: '' };
    selectLang.value = activeLang;
    inputTitle.value = f.title || '';
    inputDesc.value = f.description || '';
  }

  function syncFromInputs() {
    const f = fields[activeLang];
    if (!f) return;
    f.title = (inputTitle.value || '').trim();
    f.description = (inputDesc.value || '').trim();
  }

  applyActiveLang();

  selectLang.addEventListener('change', () => {
    syncFromInputs();
    activeLang = validateSceneLang(selectLang.value);
    applyActiveLang();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSave.disabled = true;

    try {
      syncFromInputs();

      const patch = {
        is_public: !!inputPub.checked,
        title_ua: fields.ua?.title || null,
        description_ua: fields.ua?.description || null,
        title_en: fields.en?.title || null,
        description_en: fields.en?.description || null,
        title_es: fields.es?.title || null,
        description_es: fields.es?.description || null,
      };

      await updateScene(row.id, patch);

      // Оновлюємо локальний об'єкт
      row.is_public = patch.is_public;
      row.title_ua = patch.title_ua;
      row.description_ua = patch.description_ua;
      row.title_en = patch.title_en;
      row.description_en = patch.description_en;
      row.title_es = patch.title_es;
      row.description_es = patch.description_es;

      // Перемальовуємо список
      if (currentRows && currentRows.length) renderList(currentRows);

      setStatus('');
      showCabToast('scenes.saved');
      onClose();
    } catch (err) {
      console.error(err);
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
