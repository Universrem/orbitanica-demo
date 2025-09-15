// full/js/ui/infoPanel.js
'use strict';

import { t, getCurrentLang } from '../i18n.js';
import { getUniverseLibrary } from '../data/universe.js';
import { formatHistoryVariantPrefix } from './ip_text_history.js';


let panelEl = null;
let titleEl = null;
let listEl = null;
let toggleLabelEl = null;
let toggleBtn = null;

let showDescriptions = false;

let ipHover = null;
let hoverTimer = null;
// Прапорці для одноразових підписів над О1 та О2
let baselineSubtitleShown = false;
let itemSubtitleShown = false;


const items = []; // { type:'baseline'|'item', libIndex?, realValue?, realUnit?, scaledMeters?, name?, description?, thumbUrl?, color, uiLeftLabelKey?, uiRightLabelKey?, invisibleReason?, requiredBaselineMeters? }

const LOCALES = { ua: 'uk-UA', en: 'en-US', es: 'es-ES' };
const locale = () => LOCALES[getCurrentLang?.()] || 'uk-UA';

const fmtNumber = v => (typeof v === 'number' ? v : Number(v)).toLocaleString(locale());
function fmtMeters(m) {
  if (m == null || !isFinite(m)) return '';
  if (m >= 1000) return `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: 3 })} ${t('unit.km')}`;
  return `${m.toLocaleString(locale(), { maximumFractionDigits: 2 })} ${t('unit.m')}`;
}
const UNIT_KEY = { mm: 'unit.mm', cm: 'unit.cm', m: 'unit.m', km: 'unit.km' };
const fmtUnit = code => (UNIT_KEY[code] ? t(UNIT_KEY[code]) : (code || ''));

function updateDescSwitch() {
  if (!toggleBtn) return;
  toggleBtn.setAttribute('aria-checked', showDescriptions ? 'true' : 'false');
  toggleBtn.classList.toggle('is-on', showDescriptions);
}

function scheduleHover(e, src) {
  clearTimeout(hoverTimer);
  if (!ipHover) return;
  const img = ipHover.querySelector('img');
  if (!img) return;
  img.src = src;
  hoverTimer = setTimeout(() => {
    ipHover.style.display = 'block';
    moveHover(e);
  }, 120);
}
function moveHover(e) {
  if (!ipHover) return;
  const margin = 12;
  let x = e.clientX + margin;
  let y = e.clientY + margin;
  const vw = window.innerWidth, vh = window.innerHeight;
  const rect = ipHover.getBoundingClientRect();
  if (x + rect.width > vw) x = e.clientX - rect.width - margin;
  if (y + rect.height > vh) y = e.clientY - rect.height - margin;
  ipHover.style.left = x + 'px';
  ipHover.style.top  = y + 'px';
}
function hideHover() {
  clearTimeout(hoverTimer);
  if (ipHover) ipHover.style.display = 'none';
}

function ensureDom() {
  if (panelEl) return;

  panelEl = document.createElement('div');
  panelEl.id = 'info-panel';
  panelEl.classList.add('hidden');

  titleEl = document.createElement('div');
  titleEl.className = 'info-panel__title';
  titleEl.textContent = t('ui.info_panel.title');

  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'info-panel__toggleWrap';
  toggleWrap.style.alignSelf = 'flex-start';

  toggleLabelEl = document.createElement('span');
  toggleLabelEl.className = 'info-panel__toggleLabel';
  toggleLabelEl.textContent = t('ui.info_panel.descriptions');

  toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'switch';
  toggleBtn.setAttribute('role', 'switch');
  toggleBtn.setAttribute('aria-checked', showDescriptions ? 'true' : 'false');

  const knob = document.createElement('span');
  knob.className = 'switch__knob';
  toggleBtn.appendChild(knob);

  toggleBtn.addEventListener('click', () => {
    showDescriptions = !showDescriptions;
    updateDescSwitch();
    render();
  });

  toggleWrap.append(toggleLabelEl, toggleBtn);

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.alignItems = 'flex-start';
  titleWrap.style.justifyContent = 'space-between';
  titleWrap.style.gap = '8px';
  titleWrap.append(titleEl, toggleWrap);

  listEl = document.createElement('div');

  const header = document.createElement('div');
  header.className = 'info-header';
  header.appendChild(titleWrap);

  const scroll = document.createElement('div');
  scroll.className = 'info-scroll';
  scroll.appendChild(listEl);

  panelEl.append(header, scroll);

  (document.getElementById('globe-container') || document.body).appendChild(panelEl);

  ipHover = document.createElement('div');
  ipHover.id = 'ip-hover';
  ipHover.style.position = 'fixed';
  ipHover.style.zIndex = '9999';
  ipHover.style.display = 'none';
  ipHover.style.pointerEvents = 'none';
  ipHover.style.background = '#fff';
  ipHover.style.border = '1px solid rgba(0,0,0,.15)';
  ipHover.style.boxShadow = '0 6px 18px rgba(0,0,0,.18)';
  ipHover.style.borderRadius = '6px';
  ipHover.style.padding = '6px';
  ipHover.style.maxWidth = '280px';
  ipHover.style.maxHeight = '280px';

  const ipImg = document.createElement('img');
  ipImg.style.display = 'block';
  ipImg.style.maxWidth = '268px';
  ipImg.style.maxHeight = '268px';
  ipHover.appendChild(ipImg);
  document.body.appendChild(ipHover);

  const onLang = () => {
    titleEl.textContent = t('ui.info_panel.title');
    if (toggleLabelEl) toggleLabelEl.textContent = t('ui.info_panel.descriptions');
    updateDescSwitch();
    render();
  };
  document.addEventListener('languageChanged', onLang);
  window.addEventListener('orbit:lang-change', onLang);
}

function render() {
  ensureDom();
  listEl.innerHTML = '';
  baselineSubtitleShown = false;
  itemSubtitleShown = false;


  const lib = getUniverseLibrary();
  const lang = getCurrentLang?.() || 'ua';

  // Формуємо текст підпису з ключів перекладу (якщо ключі прийшли)
  const subtitleText = (it) => {
    const leftKey = it?.uiLeftLabelKey || '';
    const rightKey = it?.uiRightLabelKey || '';
    const left = leftKey ? t(leftKey) : '';
    const right = rightKey ? t(rightKey) : '';
    if (left && right) return `${left} \u2192 ${right}`;
    if (left) return left;
    if (right) return right;
    return '';
  };

  // Додаємо підпис один раз над блоком О1 або О2, тільки якщо є ключі
  const appendSubtitleIfNeeded = (it) => {
    if (it.type === 'baseline' && !baselineSubtitleShown) {
      const txt = subtitleText(it);
      if (txt) {
        const sub = document.createElement('div');
        sub.className = 'info-panel__subtitle';
        sub.textContent = txt;
        listEl.appendChild(sub);
      }
      baselineSubtitleShown = true;
    }
    if (it.type === 'item' && !itemSubtitleShown) {
      const txt = subtitleText(it);
      if (txt) {
        const sub = document.createElement('div');
        sub.className = 'info-panel__subtitle';
        sub.textContent = txt;
        listEl.appendChild(sub);
      }
      itemSubtitleShown = true;
    }
  };

  items.forEach(it => {
    if (it.type === 'group') {

      // підпис "лівий → правий" показуємо один раз для baseline/item
if (it.groupType === 'baseline') {
  appendSubtitleIfNeeded({
    type: 'baseline',
    uiLeftLabelKey: it.uiLeftLabelKey,
    uiRightLabelKey: it.uiRightLabelKey
  });
}
// Для item (О2) підзаголовок НЕ показуємо


      // Заголовок групи
      const row = document.createElement('div');
      row.className = 'info-panel__row ip-history-group';

      const dot = document.createElement('span');
      dot.className = 'ip-dot';
      dot.style.backgroundColor = it.color || 'rgba(60,60,60,0.9)';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'ip-name ip-title';
      nameSpan.textContent = it.title || '';

      const fixUrl = (u) => {
        if (!u) return '';
        if (/^https?:\/\//i.test(u)) return u;
        if (u.startsWith('/')) return u;
        if (u.startsWith('./')) return u.slice(1);
        if (u.startsWith('../')) return '/' + u.replace(/^\.\.\//, '');
        return '/' + u.replace(/^\/+/, '');
      };
      const thumbUrl = it.thumbUrl ? fixUrl(String(it.thumbUrl).trim()) : '';
      if (thumbUrl) {
        nameSpan.classList.add('has-thumb');
        nameSpan.addEventListener('mouseenter', (e) => scheduleHover(e, thumbUrl));
        nameSpan.addEventListener('mousemove', moveHover);
        nameSpan.addEventListener('mouseleave', hideHover);
      }

      row.appendChild(dot);
      row.appendChild(nameSpan);

      // Підрядки "— початок/— завершення"
      const subwrap = document.createElement('div');
      subwrap.className = 'ip-subrows';

      (it.variants || []).forEach(v => {
        const sub = document.createElement('div');
        sub.className = 'info-panel__row ip-subrow';

        const pref = document.createElement('span');
        pref.className = 'ip-variant';
        pref.textContent = formatHistoryVariantPrefix(v.variant);
        sub.appendChild(pref);

        const real = (v.realValue != null && v.realUnit) ? `${fmtNumber(v.realValue)} ${fmtUnit(v.realUnit)}` : '';
        const scaled = (v.scaledMeters != null) ? fmtMeters(v.scaledMeters) : '';
        if (real || scaled) {
          const sep = document.createTextNode(` ${real}${(real && scaled) ? ' \u2192 ' : ''}${scaled}`);
          sub.appendChild(sep);
        }

        if (v.invisibleReason === 'tooLarge') {
          const badge = document.createElement('span');
          badge.className = 'ip-note ip-note--warn';
          badge.textContent = ' • ' + t('ui.info_panel.too_large_badge');
          sub.appendChild(badge);

          if (typeof v.requiredBaselineMeters === 'number' && isFinite(v.requiredBaselineMeters)) {
            const hint = document.createElement('span');
            hint.className = 'ip-note';
            const kmText = fmtMeters(v.requiredBaselineMeters);
            const mText  = `${Math.round(v.requiredBaselineMeters).toLocaleString(locale())} ${t('unit.m')}`;
            hint.textContent = ' — ' + t('ui.info_panel.required_baseline') + ': ' + kmText + ' (' + mText + ')';
            sub.appendChild(hint);
          }
        }

        subwrap.appendChild(sub);
      });

row.appendChild(subwrap);
listEl.appendChild(row);


      if (showDescriptions && it.description) {
        const desc = document.createElement('div');
        desc.className = 'info-panel__description';
        desc.textContent = it.description;
        listEl.appendChild(desc);
      }

      return; // пропускаємо стандартний рендер рядка
    }

    const rec = (Number.isInteger(it.libIndex) && it.libIndex >= 0) ? (lib?.[it.libIndex]) : null;

    // 1) ім'я/опис — СПОЧАТКУ беремо з it (передано режимом), і лише якщо їх немає — з бібліотеки (для зворотної сумісності)
    const nameText = (it.name && String(it.name).trim())
      ? it.name
      : (rec ? (rec[`name_${lang}`] ?? rec.name_en ?? '') : '');

    const descText = (it.description && String(it.description).trim())
      ? it.description
      : (rec ? (rec[`description_${lang}`] || '') : '');


    // Показати підпис над групою (О1 або О2), тільки якщо ключі прийшли
    appendSubtitleIfNeeded(it);

    const row = document.createElement('div');
    row.className = 'info-panel__row';

    const dot = document.createElement('span');
    dot.className = 'ip-dot';
    dot.style.backgroundColor = it.color || 'rgba(60,60,60,0.9)';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'ip-name';
    if (Number.isInteger(it.libIndex)) nameSpan.dataset.index = String(it.libIndex);
    nameSpan.textContent = nameText || '';

    const fixUrl = (u) => {
      if (!u) return '';
      if (/^https?:\/\//i.test(u)) return u;
      if (u.startsWith('/')) return u;
      if (u.startsWith('./')) return u.slice(1);
      if (u.startsWith('../')) return '/' + u.replace(/^\.\.\//, '');
      return '/' + u.replace(/^\/+/, '');
    };
    const thumbRaw = it.thumbUrl ?? rec?.image_thumb ?? rec?.image ?? rec?.image_url ?? rec?.image_full ?? '';
    const thumbUrl = thumbRaw ? fixUrl(String(thumbRaw).trim()) : '';

    if (thumbUrl) {
      nameSpan.classList.add('has-thumb');
      nameSpan.addEventListener('mouseenter', (e) => scheduleHover(e, thumbUrl));
      nameSpan.addEventListener('mousemove', moveHover);
      nameSpan.addEventListener('mouseleave', hideHover);
    }

    const real = (it.realValue != null && it.realUnit) ? `${fmtNumber(it.realValue)} ${fmtUnit(it.realUnit)}` : '';
    const scaled = (it.scaledMeters != null) ? fmtMeters(it.scaledMeters) : '';

    row.appendChild(dot);
    row.appendChild(nameSpan);
    if (real || scaled) {
      const sep = document.createTextNode(`: ${real}${(real && scaled) ? ' \u2192 ' : ''}${scaled}`);
      row.appendChild(sep);
    }
    // Позначка: об'єкт не відображається на глобусі (> π·R)
    if (it.invisibleReason === 'tooLarge') {
      const badge = document.createElement('span');
      badge.className = 'ip-note ip-note--warn';

      badge.textContent = ' • ' + t('ui.info_panel.too_large_badge');
      row.appendChild(badge);

      if (typeof it.requiredBaselineMeters === 'number' && isFinite(it.requiredBaselineMeters)) {
        const hint = document.createElement('span');
        hint.className = 'ip-note';
        const kmText = fmtMeters(it.requiredBaselineMeters); // автоматично км
const mText  = `${Math.round(it.requiredBaselineMeters).toLocaleString(locale())} ${t('unit.m')}`;
hint.textContent = ' — ' + t('ui.info_panel.required_baseline') + ': ' + kmText + ' (' + mText + ')';

        row.appendChild(hint);
      }
    }

    if (showDescriptions && descText) {
      const extra = document.createElement('div');
      extra.className = 'info-panel__extra';
      const desc = document.createElement('div');
      desc.className = 'info-panel__description';
      desc.textContent = descText;
      extra.append(desc);
      row.appendChild(extra);
    }

    listEl.appendChild(row);
  });

  panelEl.classList.toggle('hidden', items.length === 0);
}

export function initInfoPanel() { ensureDom(); }

export function clearInfoPanel(opts = {}) {
  const { hideOnly = false } = opts;
  ensureDom();
  if (hideOnly) {
    showDescriptions = false;
    updateDescSwitch();
    hideHover();
    if (listEl) listEl.innerHTML = '';
    return;
  }
  items.length = 0;
  showDescriptions = false;
  updateDescSwitch();
  hideHover();
  render();
}

export function setBaselineResult({ libIndex, realValue, realUnit, scaledMeters, name, description, color, uiLeftLabelKey, uiRightLabelKey }) {

  ensureDom();
  const rec = { type: 'baseline', libIndex, realValue, realUnit, scaledMeters, name, description, color, uiLeftLabelKey, uiRightLabelKey };
  const idx = items.findIndex(it => it.type === 'baseline');
  if (idx >= 0) items[idx] = rec; else items.unshift(rec);
  render();
}
export function addResult({ libIndex, realValue, realUnit, scaledMeters, name, description, color, uiLeftLabelKey, uiRightLabelKey, invisibleReason = null, requiredBaselineMeters = null }) {
  ensureDom();
  items.push({ type: 'item', libIndex, realValue, realUnit, scaledMeters, name, description, color, uiLeftLabelKey, uiRightLabelKey, invisibleReason, requiredBaselineMeters });
  render();
}
// ─────────────────────────────────────────────────────────────
// V2 API: інфопанель повністю покладається на дані режиму
export function setBaselineResultV2({ name, description, thumbUrl, realValue, realUnit, scaledMeters, color, uiLeftLabelKey, uiRightLabelKey, invisibleReason = null, requiredBaselineMeters = null }) {
  ensureDom();
  const rec = {
    type: 'baseline',
    libIndex: -1, // ігнорується рендером, бо name/description вже передані режимом
    name, description, thumbUrl,
    realValue, realUnit, scaledMeters,
    color, uiLeftLabelKey, uiRightLabelKey,
    invisibleReason, requiredBaselineMeters
  };
  const idx = items.findIndex(it => it.type === 'baseline');
  if (idx >= 0) items[idx] = rec; else items.unshift(rec);
  render();
}

export function addResultV2({ name, description, thumbUrl, realValue, realUnit, scaledMeters, color, uiLeftLabelKey, uiRightLabelKey, invisibleReason = null, requiredBaselineMeters = null }) {
  ensureDom();
  items.push({
    type: 'item',
    libIndex: -1, // див. вище
    name, description, thumbUrl,
    realValue, realUnit, scaledMeters,
    color, uiLeftLabelKey, uiRightLabelKey,
    invisibleReason, requiredBaselineMeters
  });
  render();
}


export function addGroup({
  id,
  title,
  color,
  thumbUrl = '',
  groupType = 'item',           // 'baseline' | 'item'
  uiLeftLabelKey,
  uiRightLabelKey
}) {
  ensureDom();
  const gid = String(id || '').trim();
  if (!gid) return;

  const idx = items.findIndex(it => it.type === 'group' && it.groupId === gid);

  const rec = {
    type: 'group',
    groupId: gid,
    groupType,
    title: String(title || ''),
    color: color || 'rgba(60,60,60,0.9)',
    thumbUrl: String(thumbUrl || ''),
    description: '',
    uiLeftLabelKey: String(uiLeftLabelKey || ''),
    uiRightLabelKey: String(uiRightLabelKey || ''),
    variants: []
  };

  if (idx >= 0) {
    const prev = items[idx];
    rec.variants = Array.isArray(prev.variants) ? prev.variants : [];
    rec.description = prev.description || '';
    items[idx] = rec;
  } else {
    if (groupType === 'baseline') items.unshift(rec); else items.push(rec);
  }
  render();
}


export function appendVariant({
  id,
  variant,
  realValue = null,
  realUnit = '',
  scaledMeters = null,
  invisibleReason = null,
  requiredBaselineMeters = null
}) {
  ensureDom();
  const gid = String(id || '').trim();
  if (!gid) return;

  const idx = items.findIndex(it => it.type === 'group' && it.groupId === gid);
  if (idx < 0) return;

  // 'start' | 'end' | 'single'
  const key = (variant === 'start' || variant === 'end') ? variant : 'single';
  const rec = { variant: key, realValue, realUnit, scaledMeters, invisibleReason, requiredBaselineMeters };

  const arr = Array.isArray(items[idx].variants) ? items[idx].variants : [];
  const pos = arr.findIndex(v => ((v?.variant === 'start' || v?.variant === 'end') ? v.variant : 'single') === key);

  if (pos >= 0) {
    arr[pos] = rec;         // upsert
  } else {
    arr.push(rec);
  }

  items[idx].variants = arr;
  render();
}

export function setGroupDescription({ id, description = '' }) {
  ensureDom();
  const gid = String(id || '').trim();
  if (!gid) return;
  const idx = items.findIndex(it => it.type === 'group' && it.groupId === gid);
  if (idx < 0) return;
  items[idx].description = String(description || '');
  render();
}


