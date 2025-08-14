'use strict';

import { t, getCurrentLang } from '../i18n.js';
import { getUniverseLibrary } from '../data/data_diameter.js';

let panelEl = null;
let titleEl = null;
let listEl = null;
let toggleLabelEl = null;
let toggleBtn = null;

let baselineSet = false;
let showDescriptions = false;

let ipHover = null;      // контейнер попапу прев’ю
let hoverTimer = null;   // затримка для ховера

// Елементи панелі (порядок додавання результатів)
const items = []; // { type: 'baseline'|'item', libIndex, realValue, realUnit, scaledMeters }

// Локаль форматування чисел
const LOCALES = { ua: 'uk-UA', en: 'en-US', es: 'es-ES' };
const locale = () => LOCALES[getCurrentLang?.()] || 'uk-UA';

// Форматування
const fmtNumber = v => (typeof v === 'number' ? v : Number(v)).toLocaleString(locale());
function fmtMeters(m) {
  if (m >= 1000) return `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: 3 })} ${t('unit.km')}`;
  return `${m.toLocaleString(locale(), { maximumFractionDigits: 2 })} ${t('unit.m')}`;
}
const UNIT_KEY = { mm: 'unit.mm', cm: 'unit.cm', m: 'unit.m', km: 'unit.km' };
const fmtUnit = code => (UNIT_KEY[code] ? t(UNIT_KEY[code]) : code);

// ── Статус тумблера описів
function updateDescSwitch() {
  if (!toggleBtn) return;
  toggleBtn.setAttribute('aria-checked', showDescriptions ? 'true' : 'false');
  toggleBtn.classList.toggle('is-on', showDescriptions);
}

// ── Попап прев’ю (ховер біля курсора)
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

// ── Підготовка DOM панелі
function ensureDom() {
  if (panelEl) return;

  panelEl = document.createElement('div');
  panelEl.id = 'info-panel';
  panelEl.classList.add('hidden');

  // Заголовок
  titleEl = document.createElement('div');
  titleEl.className = 'info-panel__title';
  titleEl.textContent = t('ui.info_panel.title');

  // Тумблер-свічер “Описи”
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

  // Шапка (заголовок + тумблер)
  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.alignItems = 'flex-start';
  titleWrap.style.justifyContent = 'space-between';
  titleWrap.style.gap = '8px';
  titleWrap.append(titleEl, toggleWrap);

  // Контейнер списку
  listEl = document.createElement('div');

  // Збір панелі
  // Новий каркас: шапка (нерухома) + прокрутний контейнер
  const header = document.createElement('div');
  header.className = 'info-header';
  header.appendChild(titleWrap);

  const scroll = document.createElement('div');
  scroll.className = 'info-scroll';
  scroll.appendChild(listEl);

  panelEl.append(header, scroll);

  (document.getElementById('globe-container') || document.body).appendChild(panelEl);

  // Попап для ховер-прев’ю зображення
  ipHover = document.createElement('div');
  ipHover.id = 'ip-hover';
  // Базові inline-стилі, щоб працювало навіть без CSS
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

  // Реакція на зміну мови
  document.addEventListener('languageChanged', () => {
    titleEl.textContent = t('ui.info_panel.title');
    if (toggleLabelEl) toggleLabelEl.textContent = t('ui.info_panel.descriptions');
    updateDescSwitch();
    render();
  });
}

// ── Рендер списку
function render() {
  ensureDom();
  listEl.innerHTML = '';

  const lib = getUniverseLibrary();
  const lang = getCurrentLang?.() || 'ua';

  items.forEach(it => {
    const rec = lib?.[it.libIndex];
    const nameText = it.name ?? (rec ? rec[`name_${lang}`] : '');
    const descText = it.description ?? (rec ? rec[`description_${lang}`] : '');

    const name = rec ? (rec[`name_${lang}`] ?? rec.name_en ?? '') : '';

    const row = document.createElement('div');
    row.className = 'info-panel__row';

    const dot = document.createElement('span');
    dot.className = 'ip-dot';
    dot.style.backgroundColor = it.color || 'rgba(60,60,60,0.9)';

    // Назва об'єкта
    const nameSpan = document.createElement('span');
    nameSpan.className = 'ip-name';
    nameSpan.dataset.index = String(it.libIndex);
    nameSpan.textContent = nameText;
    row.appendChild(dot);
    row.appendChild(nameSpan);


    // Ховер-прев’ю: беремо перше доступне поле зображення
    function fixUrl(u) {
      if (!u) return '';
      if (/^https?:\/\//i.test(u)) return u;       // вже абсолютний
      if (u.startsWith('/')) return u;              // кореневий
      if (u.startsWith('./')) return u.slice(1);    // ./res/... -> /res/...
      if (u.startsWith('../')) return '/' + u.replace(/^\.\.\//, ''); // ../res/... -> /res/...
      return '/' + u.replace(/^\/+/, '');           // res/... -> /res/...
    }
    const thumbUrl = fixUrl((rec?.image_thumb || rec?.image || rec?.image_url || rec?.image_full || '').trim());

    if (thumbUrl) {
      nameSpan.classList.add('has-thumb');
      nameSpan.addEventListener('mouseenter', (e) => scheduleHover(e, thumbUrl));
      nameSpan.addEventListener('mousemove', moveHover);
      nameSpan.addEventListener('mouseleave', hideHover);
    }

    // Компактний запис значень: "Назва: 12 742 км → 100 м"
    const real = `${fmtNumber(it.realValue)} ${fmtUnit(it.realUnit)}`;
    const scaled = fmtMeters(it.scaledMeters);

    row.appendChild(nameSpan);
    row.appendChild(document.createTextNode(`: ${real} \u2192 ${scaled}`));

    // Розширений блок (лише опис), якщо увімкнуто
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

// ── Публічні API
export function initInfoPanel() { ensureDom(); }

export function clearInfoPanel() {
  ensureDom();
  items.length = 0;
  baselineSet = false;
  showDescriptions = false;
  updateDescSwitch();
  hideHover();    
  render();
}

export function setBaselineResult({ libIndex, realValue, realUnit, scaledMeters, name, description, color }) {
  ensureDom();
  if (baselineSet) return;
  items.push({ type: 'baseline', libIndex, realValue, realUnit, scaledMeters, name, description, color });
  baselineSet = true;
  render();
}

export function addResult({ libIndex, realValue, realUnit, scaledMeters, name, description, color }) {
  ensureDom();
  items.push({ type: 'item', libIndex, realValue, realUnit, scaledMeters, name, description, color });
  render();
}




