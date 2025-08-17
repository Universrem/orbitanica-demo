// full/js/ui/infoPanel.js
'use strict';

import { t, getCurrentLang } from '../i18n.js';
import { getUniverseLibrary } from '../data/data_diameter.js';

let panelEl = null;
let titleEl = null;
let listEl = null;
let toggleLabelEl = null;
let toggleBtn = null;

let showDescriptions = false;

let ipHover = null;
let hoverTimer = null;

const items = []; // { type:'baseline'|'item', libIndex, realValue, realUnit, scaledMeters, name?, description?, color }

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

  const lib = getUniverseLibrary();
  const lang = getCurrentLang?.() || 'ua';

  items.forEach(it => {
    const rec = (Number.isInteger(it.libIndex) && it.libIndex >= 0) ? (lib?.[it.libIndex]) : null;

    const nameText = rec
      ? (rec[`name_${lang}`] ?? rec.name_en ?? '')
      : (it.name || '');

    const descText = rec
      ? (rec[`description_${lang}`] || '')
      : (it.description || '');

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
    const thumbUrl = fixUrl((rec?.image_thumb || rec?.image || rec?.image_url || rec?.image_full || '').trim());
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

export function setBaselineResult({ libIndex, realValue, realUnit, scaledMeters, name, description, color }) {
  ensureDom();
  const rec = { type: 'baseline', libIndex, realValue, realUnit, scaledMeters, name, description, color };
  const idx = items.findIndex(it => it.type === 'baseline');
  if (idx >= 0) items[idx] = rec; else items.unshift(rec);
  render();
}

export function addResult({ libIndex, realValue, realUnit, scaledMeters, name, description, color }) {
  ensureDom();
  items.push({ type: 'item', libIndex, realValue, realUnit, scaledMeters, name, description, color });
  render();
}
