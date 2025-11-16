// /cabinet/js/wire/myObjects.js
// My objects: без "Category:" у шапці, unit із unit_key, тултіпи через aria-label.
// №1 — найстаріший.

import { t, getCurrentLang } from '/js/i18n.js';
import { getUserEmail } from '/cabinet/js/cloud/auth.cloud.js';
import { listMine as listMineCloud } from '/cabinet/js/cloud/userObjects.cloud.js';
import { getStore } from '/js/userObjects/api.js';
import { openCabinetSignInDialog } from '/cabinet/js/account.menu.js';
import { openDeleteModal } from '/cabinet/js/wire/deleteModal.js';

const MODAL_KEY = 'my-objects';
const EDIT_MODAL_KEY = 'edit-object';
const SUPPORTED_MODES = ['distance','diameter','mass','luminosity','money','geo_population','geo_objects','geo_area','math','history'];

const tStrict = (k, fb='') => { const v = t(k); return (v==null || v===k) ? fb : String(v); };

// Єдині підтримувані мови
const LANGS = ['en','es','ua'];
const validateLang = (l) => (l==='en'||l==='es'||l==='ua') ? l : 'ua';
const currLang = () => {
  try {
    const l = (typeof getCurrentLang === 'function') ? String(getCurrentLang()).toLowerCase() : '';
    return validateLang(l);
  } catch { return 'ua'; }
};

const trim = v => (v==null?'':String(v)).trim();
const safeDate = it => String(it?.created_at||'').slice(0,10);

// fallback: спершу поточна → інші (алфавітно)
function langsOrder(L) {
  const x = validateLang((L||'ua').toLowerCase());
  return [x, ...LANGS.filter(l => l!==x)];
}
function parseMaybeJson(x) {
  if (!x || typeof x !== 'string') return x;
  try { return JSON.parse(x); } catch { return null; }
}

/** Вибір значення для ВІДОБРАЖЕННЯ: *_<curr> → *_<fallback> → base → bag */
function pickI18n(it, base, L = currLang()) {
  const order = langsOrder(L);
  const rawBag = it?.[`${base}_i18n`];
  const bag = (rawBag && typeof rawBag === 'string') ? parseMaybeJson(rawBag) : rawBag;

  const direct = trim(it?.[`${base}_${order[0]}`]);  if (direct) return direct;
  const fromBag = trim(bag?.[order[0]]);            if (fromBag) return fromBag;

  for (let i=1;i<order.length;i++){
    const via = trim(it?.[`${base}_${order[i]}`]);  if (via) return via;
    const viaBag = trim(bag?.[order[i]]);           if (viaBag) return viaBag;
  }
  const baseVal = trim(it?.[base]);                 if (baseVal) return baseVal;

  return '';
}

/** Сирове значення ДЛЯ РЕДАГУВАННЯ: тільки конкретна мова (+ bag), без перетікання між мовами */
function rawLocalized(it, base, L) {
  const rawBag = it?.[`${base}_i18n`];
  const bag = (rawBag && typeof rawBag === 'string') ? parseMaybeJson(rawBag) : rawBag;

  const col = trim(it?.[`${base}_${L}`]);
  if (col) return col;

  const bagVal = trim(bag?.[L]);
  if (bagVal) return bagVal;

  // для UA ще можемо підхопити базове поле
  if (L === 'ua') {
    const baseVal = trim(it?.[base]);
    if (baseVal) return baseVal;
  }
  return '';
}

/* ───── поля ───── */
const nameOf = (it, L=currLang()) => pickI18n(it, 'name', L) || '—';
const descOf = (it, L=currLang()) => pickI18n(it, 'description', L);
const catOf  = (it, L=currLang()) => pickI18n(it, 'category', L); // тільки назви, без *_key

function modeLine(mode) {
  const m = String(mode||'').toLowerCase();

  // Всесвіт
  if (['distance','diameter','mass','luminosity'].includes(m)) {
    const top = tStrict('panel_title_univers');
    const sub = tStrict(`panel_title_univers_${m}`);
    return top && sub ? `${top}: ${sub}` : (top || sub || m || '—');
  }

  // Гроші
  if (m === 'money') {
    return tStrict('panel_title_money','Money');
  }

  // Географія: населення / об’єкти / площі
  if (m === 'geo_population') {
    const top = tStrict('panel_title_geo');
    const sub = tStrict('panel_title_geo_population');
    return top && sub ? `${top}: ${sub}` : (top || sub || m || '—');
  }
  if (m === 'geo_objects') {
    const top = tStrict('panel_title_geo');
    const sub = tStrict('panel_title_geo_objects');
    return top && sub ? `${top}: ${sub}` : (top || sub || m || '—');
  }
  if (m === 'geo_area') {
    const top = tStrict('panel_title_geo');
    const sub = tStrict('panel_title_geo_area');
    return top && sub ? `${top}: ${sub}` : (top || sub || m || '—');
  }

  // Математика
  if (m === 'math') {
    return tStrict('panel_title_math','Math');
  }

  // Історія
  if (m === 'history') {
    return tStrict('panel_title_history','History');
  }

  return m || '—';
}

function toast(text){
  let root = document.getElementById('cab-toast-root');
  if (!root) { root = document.createElement('div'); root.id = 'cab-toast-root'; document.body.appendChild(root); }
  const el = document.createElement('div'); el.className = 'cab-toast'; el.textContent = text;
  root.appendChild(el); void el.offsetWidth; el.classList.add('show');
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),200); },1600);
}

/* ───── локальний стан редагування (багатомовний) ───── */

let editLang = currLang(); // активна мова в модалці редагування
let editFields = {
  ua: { name: '', desc: '' },
  en: { name: '', desc: '' },
  es: { name: '', desc: '' },
};

function initEditFieldsFromItem(item) {
  const make = (L) => ({
    name: rawLocalized(item, 'name', L),
    desc: rawLocalized(item, 'description', L),
  });

  editFields = {
    ua: make('ua'),
    en: make('en'),
    es: make('es'),
  };
}

/* ───────────────────────── події для синхронізації ───────────────────────── */

function emitDom(name, detail) {
  try {
    const evt = new CustomEvent(name, { detail });
    document.dispatchEvent(evt);
    window.dispatchEvent(evt);
  } catch {}
}

function broadcastAddedOrChanged(object) {
  if (!object) return;
  const mode = object.mode || null;
  const payload = { mode, object };
  emitDom('user-objects-changed', payload);
  emitDom('user-objects-added', payload);
  emitDom('user-objects-updated', payload);
  emitDom('univers-lib-reloaded', { mode, reason: 'user-add', id: object.id });
}

function broadcastRemoved(id, mode) {
  if (!id) return;
  emitDom('user-objects-removed', { id, mode });
  emitDom('user-objects-removed', { mode, id });
  emitDom('univers-lib-reloaded', { mode, reason: 'user-remove', id });
}

/* ───────── modal (список) ───────── */
let escMain = null;
function ensureMainModal(){
  let overlay = document.querySelector(`.cab-modal-overlay[data-modal="${MODAL_KEY}"]`);
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.className = 'cab-modal-overlay';
  overlay.setAttribute('data-modal', MODAL_KEY);

  const modal = document.createElement('div'); modal.className = 'cab-modal';

  const header = document.createElement('div'); header.className = 'cab-modal-header';
  const title  = document.createElement('div'); title.className = 'cab-modal-title';
  title.textContent = tStrict('ui.topbar.my_objects','My objects');

  const btnX = document.createElement('button');
  btnX.type = 'button';
  btnX.className = 'cab-close-btn';
  btnX.setAttribute('aria-label', tStrict('cab_save_btn_close','Close'));
  btnX.textContent = '×';

  header.append(title, btnX);

  const body = document.createElement('div'); body.className='cab-modal-body';
  const status = document.createElement('div'); status.className='cab-status';
  const list = document.createElement('div'); list.className='cab-scenes-list'; list.id='cab-my-objects-list';
  body.append(status, list);

  modal.append(header, body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => { overlay.remove(); if (escMain) document.removeEventListener('keydown', escMain); escMain=null; };
  btnX.addEventListener('click', close);
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  escMain = (e)=>{ if(e.key==='Escape') close(); };
  document.addEventListener('keydown', escMain);
  return overlay;
}
const setMainStatus = txt => {
  const el=document.querySelector(`.cab-modal-overlay[data-modal="${MODAL_KEY}"]`); if(!el) return;
  const s=el.querySelector('.cab-status'); if(!s) return;
  s.textContent=txt||''; s.style.display=txt?'':'none';
};
const listEl = () => document.getElementById('cab-my-objects-list');

/* ───────── modal (редагування) ───────── */
let escEdit = null;
let currentEdit = null;

function syncFormToBuffer() {
  const overlay = document.querySelector(`.cab-modal-overlay[data-modal="${EDIT_MODAL_KEY}"]`);
  if (!overlay || !currentEdit) return;
  const form = overlay.querySelector('#obj-edit-form');
  if (!form) return;

  const L = editLang || 'ua';
  const nameInput = form.elements.name_local;
  const descInput = form.elements.description_local;

  if (!editFields[L]) editFields[L] = { name: '', desc: '' };
  if (nameInput) editFields[L].name = trim(nameInput.value);
  if (descInput) editFields[L].desc = trim(descInput.value);
}

function setActiveLang(L, opts = {}) {
  const overlay = document.querySelector(`.cab-modal-overlay[data-modal="${EDIT_MODAL_KEY}"]`);
  if (!overlay || !currentEdit) return;
  const form = overlay.querySelector('#obj-edit-form');
  if (!form) return;

  const next = validateLang(L);

  if (!opts.skipSync) {
    syncFormToBuffer();
  }

    editLang = next;
  form.setAttribute('data-lang', editLang);

  const select = overlay.querySelector('#obj-edit-lang-select');
  if (select && select.value !== editLang) {
    select.value = editLang;
  }

  const f = editFields[editLang] || { name: '', desc: '' };

  if (form.elements.name_local) form.elements.name_local.value = f.name || '';
  if (form.elements.description_local) form.elements.description_local.value = f.desc || '';
}

function ensureEditModal(){
  let overlay = document.querySelector(`.cab-modal-overlay[data-modal="${EDIT_MODAL_KEY}"]`);
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.className = 'cab-modal-overlay';
  overlay.setAttribute('data-modal', EDIT_MODAL_KEY);

  const modal = document.createElement('div');
  modal.className='cab-modal';

  // ── Хедер: "Редагувати" + хрестик ────────────────────────────
  const head = document.createElement('div');
  head.className='cab-modal-header';

  const h = document.createElement('div');
  h.className='cab-modal-title';
  h.textContent = tStrict('scenes.edit','Edit');

  const btnX = document.createElement('button');
  btnX.type='button';
  btnX.className='cab-close-btn';
  btnX.setAttribute('aria-label', tStrict('cab_save_btn_close','Close'));
  btnX.textContent='×';

  head.append(h, btnX);

  // ── Тіло ─────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className='cab-modal-body';

  body.innerHTML = `
    <div class="cab-edit-meta" id="obj-edit-mode-line"></div>
    <div class="cab-edit-meta" id="obj-edit-category-line"></div>

    <form id="obj-edit-form" class="cab-form">
      <!-- 1. Мова перекладу — як у сцен: окремий рядок форми -->
      <div class="cab-form-row cab-form-row--lang">
        <label for="obj-edit-lang-select">${tStrict('objects.field_lang','Мова перекладу')}</label>
        <select id="obj-edit-lang-select" name="lang_local" class="cab-select">
          <option value="ua">UA</option>
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
      </div>

      <!-- 2. Назва -->
      <div class="cab-form-row">
        <label for="obj-edit-name">${tStrict('field_name','Name')}</label>
        <input id="obj-edit-name" name="name_local" autocomplete="off">
      </div>

      <!-- 3. Value + unit (read-only рядок) -->
      <div class="cab-form-row">
        <div id="obj-edit-valueunit"></div>
      </div>

      <!-- 4. Опис -->
      <div class="cab-form-row">
        <label for="obj-edit-desc">${tStrict('modal_field_desc','Description')}</label>
        <textarea id="obj-edit-desc" name="description_local" rows="3"></textarea>
      </div>

      <!-- 5. Кнопки -->
      <div class="cab-form-actions">
        <button type="submit" class="cab-btn cab-btn--primary">
          ${tStrict('cab_save_btn_save','Save')}
        </button>
        <button type="button" id="obj-edit-cancel" class="cab-btn">
          ${tStrict('btn_cancel','Cancel')}
        </button>
      </div>
    </form>
  `;

  modal.append(head, body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // ── Закриття ─────────────────────────────────────────────────
  const close = ()=>{ 
    overlay.remove(); 
    if(escEdit) document.removeEventListener('keydown', escEdit); 
    escEdit=null; 
    currentEdit=null; 
  };
  btnX.addEventListener('click', close);
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  escEdit = (e)=>{ if(e.key==='Escape') close(); };
  document.addEventListener('keydown', escEdit);

  // ── Селектор мови (select) ───────────────────────────────────
  const langSelect = overlay.querySelector('#obj-edit-lang-select');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      if (!currentEdit) return;
      const L = e.target.value;
      setActiveLang(L);
    });
  }

  // ── Сабміт: зберігаємо всі мови разом ────────────────────────
  overlay.querySelector('#obj-edit-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    if (!currentEdit) return close();

    // синхронізуємо активну мову в буфер
    syncFormToBuffer();

    const patch = {
      id: currentEdit.id,
      mode: currentEdit.mode,
    };

    ['ua','en','es'].forEach(L => {
      const f = editFields[L] || { name: '', desc: '' };
      patch[`name_${L}`] = trim(f.name);
      patch[`description_${L}`] = trim(f.desc);
    });

    try{
      const saved = await getStore().add({ ...currentEdit, ...patch });
      const i = rows.findIndex(x => x.id === saved.id);
      if (i >= 0) rows.splice(i, 1, saved);
      renderList(rows);
      broadcastAddedOrChanged(saved);

      toast(tStrict('objects.saved','Зміни збережені'));
      close();
    }catch(err){
      console.error(err);
      toast(tStrict('errors.generic','Something went wrong.'));
    }
  });

  // Cancel
  const btnCancel = overlay.querySelector('#obj-edit-cancel');
  if (btnCancel) {
    btnCancel.addEventListener('click', () => btnX.click());
  }

  return overlay;
}

function openEditModal(item){
  currentEdit = item;
  initEditFieldsFromItem(item);

  const overlay = ensureEditModal();
  const modeEl = overlay.querySelector('#obj-edit-mode-line');
  const catEl  = overlay.querySelector('#obj-edit-category-line');

  if (modeEl) modeEl.textContent = `${tStrict('field_mode','Mode')}: ${modeLine(item.mode)}`;

  const cat = catOf(item);
  if (catEl) catEl.textContent = cat ? `${tStrict('field_category','Category')}: ${cat}` : '';

  // значення value + unit (read-only)
  const unit = (item?.unit_key ?? item?.unit ?? '').toString().trim();
  const val  = (item?.value != null) ? String(item.value) : '';
  const vu   = (val || unit) ? `${tStrict('field_value','Value')}: ${[val, unit].filter(Boolean).join(' ')}` : '';
  const roEl = overlay.querySelector('#obj-edit-valueunit');
  if (roEl) roEl.textContent = vu;

  // активна мова — поточна мова інтерфейсу; перший setActiveLang без sync
  editLang = currLang();
  setActiveLang(editLang, { skipSync: true });
}

/* ───────── список ───────── */
let rows = [];

// єдиний конструктор іконок з коректними тултіпами (aria-label)
function iconBtn({ tip, src, onClick }){
  const btn = document.createElement('button');
  btn.type='button';
  btn.className = 'cab-icon-btn has-tip';
  btn.setAttribute('aria-label', tip);
  const img = document.createElement('img');
  img.className='cab-icon'; img.src=src; img.alt='';
  btn.appendChild(img);
  btn.addEventListener('click', onClick);
  return btn;
}

function renderEmpty(){
  const el = listEl(); if (!el) return;
  el.innerHTML = `
    <div class="cab-empty">
      <div class="cab-empty__title">${tStrict('objects.empty','No objects yet.')}</div>
      <div class="cab-empty__hint">${tStrict('objects.hint','Create your first object in any mode.')}</div>
    </div>`;
}

function renderList(arr){
  const el = listEl(); if (!el) return;
  el.innerHTML = '';
  if (!arr || arr.length===0) { renderEmpty(); return; }

  arr.forEach((row, idx)=>{
    const card = document.createElement('div'); card.className='cab-scene-card';

    // (1) Режим:підрежим · Категорія (без "Category:")
    const lineTop = document.createElement('div');
    lineTop.className = 'cab-scene-meta';
    const cat = catOf(row);
    lineTop.textContent = `${modeLine(row.mode)}${cat ? ' · ' + cat : ''}`;

    // (2) №. Назва — value + unit
    const title = document.createElement('div');
    title.className = 'cab-object-title';
    title.style.cssText = 'font-weight:600;margin:2px 0;';
    const unit = (row?.unit_key ?? row?.unit ?? '').toString().trim();
    const val  = (row?.value != null) ? String(row.value) : '';
    const valueUnit = (val || unit) ? ` — ${[val, unit].filter(Boolean).join(' ')}` : '';
    title.textContent = `${idx+1}. ${nameOf(row)}${valueUnit}`;

    // (3) Опис:
    const desc = document.createElement('div');
    desc.className = 'cab-scene-desc';
    const descVal = descOf(row);
    const descLabel = tStrict('modal_field_desc','Description');
    desc.textContent = descVal ? `${descLabel}: ${descVal}` : `${descLabel}:`;

    // (4) Дата
    const date = document.createElement('div');
    date.className = 'cab-scene-meta';
    date.textContent = safeDate(row);

    // (5) Дії
    const actions = document.createElement('div'); actions.className='cab-scene-actions';
    const isPublic = !!row.is_public;

    const btnPub = iconBtn({
      src: isPublic ? '/res/icons/public.png' : '/res/icons/private.png',
      tip: isPublic ? tStrict('scenes.make_private','Make private') : tStrict('scenes.make_public','Make public'),
      onClick: async ()=>{
        try{
          const saved = await getStore().add({ ...row, is_public: !isPublic });
          const i = rows.findIndex(x=>x.id===saved.id);
          if (i>=0) rows.splice(i,1,saved);
          renderList(rows);
          broadcastAddedOrChanged(saved);

          toast(saved.is_public ? tStrict('scenes.public','Public') : tStrict('scenes.private','Private'));
        }catch(e){ console.error(e); toast(tStrict('errors.generic','Something went wrong.')); }
      }
    });

    const btnEdit = iconBtn({
      src:'/res/icons/edit.png',
      tip:tStrict('scenes.edit','Edit'),
      onClick: ()=> openEditModal(row)
    });

    const btnDel = iconBtn({
      src:'/res/icons/delete.png',
      tip:tStrict('scenes.delete','Delete'),
      onClick: async ()=>{
        const ok = await openDeleteModal({
          messageKey: 'confirm.delete.object',
          displayName: nameOf(row)
        });
        if (!ok) return;
        try{
          await getStore().remove(row.id, row.mode);
          rows = rows.filter(x=>x.id!==row.id);
          renderList(rows);
          broadcastRemoved(row.id, row.mode);

          toast(tStrict('scenes.deleted','Deleted'));
        }catch(e){ console.error(e); toast(tStrict('errors.generic','Something went wrong.')); }
      }
    });

    actions.append(btnPub, btnEdit, btnDel);
    card.append(lineTop, title, desc, date, actions);
    el.appendChild(card);
  });
}

/* ───────── data ───────── */
async function fetchAllMine(){
  const out=[];
  for (const mode of SUPPORTED_MODES){
    let cursor=null;
    do{
      const pkg = await listMineCloud(mode, 100, cursor);
      const items = Array.isArray(pkg?.items) ? pkg.items : [];
      out.push(...items);
      cursor = pkg?.nextCursor || null;
    } while(cursor);
  }
  out.sort((a,b)=> String(a.created_at||'').localeCompare(String(b.created_at||'')));
  return out;
}

async function openMyObjects(){
  const email = await getUserEmail();
  if (!email) { openCabinetSignInDialog(); return; }
  ensureMainModal();
  setMainStatus(tStrict('loading','Loading…'));
  try{
    rows = await fetchAllMine();
    setMainStatus('');
    renderList(rows);
  }catch(e){
    console.error(e);
    setMainStatus(tStrict('errors.generic','Something went wrong.'));
    renderEmpty();
  }
}

/* ───────── language sync: перерендер при зміні мови ───────── */
function rerenderForLangChange(){
  const overlayList = document.querySelector(`.cab-modal-overlay[data-modal="${MODAL_KEY}"]`);
  if (overlayList && rows?.length) renderList(rows);

  const overlayEdit = document.querySelector(`.cab-modal-overlay[data-modal="${EDIT_MODAL_KEY}"]`);
  if (overlayEdit && currentEdit) {
    const titleEl = overlayEdit.querySelector('.cab-modal-title');
    if (titleEl) titleEl.textContent = tStrict('scenes.edit','Edit');

    const modeEl  = overlayEdit.querySelector('#obj-edit-mode-line');
    if (modeEl) modeEl.textContent = `${tStrict('field_mode','Mode')}: ${modeLine(currentEdit.mode)}`;

    const catEl   = overlayEdit.querySelector('#obj-edit-category-line');
    const cat     = catOf(currentEdit);
    if (catEl) catEl.textContent = cat ? `${tStrict('field_category','Category')}: ${cat}` : '';

        const langLabelText = overlayEdit.querySelector('label[for="obj-edit-lang-select"]');
    if (langLabelText) {
      langLabelText.textContent = tStrict('objects.field_lang','Мова перекладу');
    }

    // переактивувати мову за мовою інтерфейсу, але збережені значення лишаються в editFields
    editLang = currLang();
    setActiveLang(editLang, { skipSync: true });
  }
}
['languageChanged','lang-changed','i18n:changed','i18nextLanguageChanged']
  .forEach(ev=>document.addEventListener(ev, rerenderForLangChange));

document.addEventListener('cabinet:open-my-objects', openMyObjects);
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('#btn-my-objects');
  if (btn) { e.preventDefault(); document.dispatchEvent(new CustomEvent('cabinet:open-my-objects')); }
});
