// js/ui/infoPanel.js
'use strict';

import { t, getCurrentLang } from '../i18n.js';
import { getUniverseLibrary } from '../data/universe.js';
import { formatHistoryVariantPrefix } from './ip_text_history.js';
import { getO1ExamplesForMode } from '../utils/o1_examples.js';

let panelEl = null;
let titleEl = null;
let listEl = null;
let toggleLabelEl = null;
let toggleBtn = null;
let modeEl = null;
let modeLabelState = { modeKey: '', subKey: '' };
let showDescriptions = false;
let showEmptyState = false;
let ipHover = null;
let hoverTimer = null;
let baselineSubtitleShown = false;
let itemSubtitleShown = false;

function currentModeId() {
  const modeKey = modeLabelState.modeKey || '';
  const subKey  = modeLabelState.subKey  || '';

  // Всесвіт
  if (modeKey === 'panel_title_univers') {
    if (subKey === 'panel_title_univers_distance')   return 'univers_distance';
    if (subKey === 'panel_title_univers_diameter')   return 'univers_diameter';
    if (subKey === 'panel_title_univers_mass')       return 'univers_mass';
    if (subKey === 'panel_title_univers_luminosity') return 'univers_luminosity';
  }

  // Географія
  if (modeKey === 'panel_title_geo') {
    if (subKey === 'panel_title_geo_population') return 'geo_population';
    if (subKey === 'panel_title_geo_area')       return 'geo_area';
    if (subKey === 'panel_title_geo_objects')    return 'geo_objects';
  }

  // Інші режими
  if (modeKey === 'panel_title_history') return 'history';
  if (modeKey === 'panel_title_math')    return 'math';
  if (modeKey === 'panel_title_money')   return 'money';

  return null;
}

const items = []; // { type:'baseline'|'item', libIndex?, realValue?, realUnit?, scaledMeters?, name?, description?, thumbUrl?, color, uiLeftLabelKey?, uiRightLabelKey?, invisibleReason?, requiredBaselineMeters? }

const LOCALES = { ua: 'uk-UA', en: 'en-US', es: 'es-ES' };
const locale = () => LOCALES[getCurrentLang?.()] || 'uk-UA';

const fmtNumber = v => (typeof v === 'number' ? v : Number(v)).toLocaleString(locale());

function fmtMeters(m) {
  if (m == null || !isFinite(m)) return '';
  const value = Number(m);
  if (!Number.isFinite(value)) return '';

  // великі значення — км
  if (value >= 1000) {
    const km = value / 1000;
    return `${km.toLocaleString(locale(), { maximumFractionDigits: 2 })} ${t('unit.km')}`;
  }

  // від 1 м і вище — метри
  if (value >= 1) {
    return `${value.toLocaleString(locale(), { maximumFractionDigits: 2 })} ${t('unit.m')}`;
  }

  // від 1 см до 1 м — сантиметри
  if (value >= 0.01) {
    const cm = value * 100;
    return `${cm.toLocaleString(locale(), { maximumFractionDigits: 2 })} ${t('unit.cm')}`;
  }

  // менше 1 см — міліметри, але з багатьма знаками, щоб не було «0 мм»
  const mm = value * 1000;
  return `${mm.toLocaleString(locale(), { maximumFractionDigits: 10 })} ${t('unit.mm')}`;
}

// точне число в метрах (для підказки, що ввести в О1)
function fmtMetersExact(m) {
  if (m == null || !isFinite(m)) return '';
  const value = Number(m);
  if (!isFinite(value)) return '';
  return value.toLocaleString(locale(), { maximumFractionDigits: 10 });
}

// Пошук відповідного прикладу O1 за значенням у метрах (з урахуванням режиму)
function findO1ExampleByMeters(m) {
  if (m == null || !isFinite(m)) return null;
  const target = Number(m);
  if (!isFinite(target)) return null;

  const modeId   = currentModeId();
  const examples = getO1ExamplesForMode(modeId);

  for (const ex of examples || []) {
    const val = Number(ex?.value_m);
    if (!isFinite(val)) continue;
    const eps = Math.max(1e-12, Math.abs(val) * 1e-6);
    if (Math.abs(val - target) <= eps) return ex;
  }
  return null;
}
// Формат масштабованого діаметра для О1:
// - якщо це значення з O1_EXAMPLES для поточного режиму → тільки Назва прикладу
// - якщо користувач ввів своє число → просто число з одиницею
function formatBaselineScaled(m) {
  const ex = findO1ExampleByMeters(m);
  if (ex) {
    const label = t('o1_example_' + ex.key) || ex.key || '';
    if (label) return label; // у тексті вже є число (наприклад, "Міст Золоті Ворота (1280 м)")
  }
  return fmtMeters(m);
}
// Людяний формат для "потрібної базової відстані" САМЕ В МЕТРАХ.
// Це число користувач має ввести в полі О1.
// - |m| >= 1 м  -> цілі метри, без дробу (3958 м)
// - 0 < |m| < 1 -> десятковий запис з такою кількістю знаків після коми,
//                  щоб показати першу ненульову цифру (наприклад 0,0000000000006 м)
function fmtRequiredBaselineMeters(m) {
  if (m == null || !isFinite(m)) return '';
  const value = Number(m);
  if (!Number.isFinite(value)) return '';

  const abs = Math.abs(value);

  if (abs === 0) {
    return `0 ${t('unit.m')}`;
  }

  // 1 м і більше — цілі метри
  if (abs >= 1) {
    const rounded = Math.round(value);
    const num = rounded.toLocaleString(locale(), { maximumFractionDigits: 0 });
    return `${num} ${t('unit.m')}`;
  }

  // 0 < м < 1 — десятковий запис:
  // кількість знаків після коми = позиція першої ненульової цифри
  // (щоб 5,796×10^-13 стало 0,0000000000006 м)
  const decimals = Math.min(15, -Math.floor(Math.log10(abs)));
  const num = value.toLocaleString(locale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return `${num} ${t('unit.m')}`;
}

// Формат підказки «потрібна базова відстань для відображення».
// ТУТ БЕЗ O1_EXAMPLES — тільки чисте число в метрах.
function formatRequiredBaseline(m) {
  if (m == null || !isFinite(m)) return '';
  return fmtRequiredBaselineMeters(m);
}
// Мовозалежна форма для "людина / людини / людей" тощо
function formatPeopleUnit(value) {
  const lang = getCurrentLang?.() || 'ua';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '';

  const abs = Math.abs(n);
  const intVal = Math.floor(abs);

  if (!Number.isFinite(intVal)) {
    return t('unit.people.many');
  }

  // Українська: 1 людина, 2–4 людини, 5+ людей, 11–14 теж "людей"
  if (lang === 'ua') {
    const lastTwo = intVal % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return t('unit.people.many');

    const last = intVal % 10;
    if (last === 1) return t('unit.people.one');
    if (last >= 2 && last <= 4) return t('unit.people.few');
    return t('unit.people.many');
  }

  // Англійська / іспанська: 1 -> однина, інакше множина
  if (lang === 'en' || lang === 'es') {
    return intVal === 1 ? t('unit.people.one') : t('unit.people.many');
  }

  // запасний варіант
  return intVal === 1 ? t('unit.people.one') : t('unit.people.many');
}

const UNIT_KEY = { mm: 'unit.mm', cm: 'unit.cm', m: 'unit.m', km: 'unit.km' };

function fmtUnit(code) {
  const c = String(code || '').trim();
  if (!c) return '';

  // базові (як було)
  if (UNIT_KEY[c]) return t(UNIT_KEY[c]);

  // універсальний варіант: шукаємо "unit.<ЮНІТ>" у translations.json
  const key = `unit.${c}`;
  const tr = t(key);

  // якщо переклад знайдено — t() поверне не сам ключ
  if (tr && tr !== key) return tr;

  // фолбек: показуємо як є
  return c;
}

// Формат "реального" значення з урахуванням одиниці.
// Тут вирішуємо, як саме писати людей, метри тощо.
function fmtRealValue(value, unitCode) {
  if (value == null || !isFinite(value)) return '';

  const n = (typeof value === 'number') ? value : Number(value);
  if (!Number.isFinite(n)) return '';

  // без одиниці — просто число
  if (!unitCode) {
    return fmtNumber(n);
  }

  // Спеціальний випадок: населення
  if (unitCode === 'people') {
    const unit = formatPeopleUnit(n);
    if (!unit) return fmtNumber(n);
    return `${fmtNumber(n)} ${unit}`;
  }

  // Усі інші одиниці через словник
  return `${fmtNumber(n)} ${fmtUnit(unitCode)}`;
}

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
function computeModeLabel() {
  const a = modeLabelState.modeKey ? t(modeLabelState.modeKey) : '';
  const b = modeLabelState.subKey ? t(modeLabelState.subKey) : '';
  if (a && b) return `${a}: ${b}`;
  return a || b || '';
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

  modeEl = document.createElement('div');
  modeEl.className = 'info-panel__mode';
  modeEl.textContent = computeModeLabel();
  header.appendChild(modeEl);

  const scroll = document.createElement('div');
  scroll.className = 'info-scroll';
  scroll.appendChild(listEl);

  panelEl.append(header, scroll);

  (document.getElementById('globe-container') || document.body).appendChild(panelEl);

  // 🔔 нове: сигнал, що інфопанель створена і готова для мобільних жестів
  window.dispatchEvent(new CustomEvent('orbitanica:info-panel-ready', {
    detail: panelEl
  }));

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
    if (modeEl) modeEl.textContent = computeModeLabel();

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
  let lastBaselineSubtitle = '';

    if (items.length === 0) {
    if (showEmptyState) {
      const row = document.createElement('div');
      row.className = 'info-panel__row info-panel__row--empty';
      const text = document.createElement('div');
      text.className = 'info-panel__empty-text';
      text.textContent = t('ui.info_panel.empty');
      row.appendChild(text);

listEl.appendChild(row);

      panelEl.classList.remove('hidden');
    } else {
      panelEl.classList.add('hidden');
    }
    return;
  }

  showEmptyState = false;


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
  lastBaselineSubtitle = subtitleText(it);

}
// Для item (О2) покажемо один підзаголовок, якщо він відрізняється від baseline
if (!itemSubtitleShown) {
  const txtItem = subtitleText(it);
  if (txtItem && txtItem !== lastBaselineSubtitle) {
    appendSubtitleIfNeeded({
      type: 'item',
      uiLeftLabelKey: it.uiLeftLabelKey,
      uiRightLabelKey: it.uiRightLabelKey
    });
  }
}
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

        const real = fmtRealValue(v.realValue, v.realUnit);

      let scaled = '';
      if (v.scaledMeters != null && isFinite(v.scaledMeters)) {
        // для групи-baseline (О1) додаємо приклад із O1_EXAMPLES
        scaled = (it.groupType === 'baseline')
          ? formatBaselineScaled(v.scaledMeters)
          : fmtMeters(v.scaledMeters);
      }

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
    const baseText = formatRequiredBaseline(v.requiredBaselineMeters);
    if (baseText) {
      hint.textContent = ' — ' + t('ui.info_panel.required_baseline') + ': ' + baseText;
      sub.appendChild(hint);
    }
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

const real = fmtRealValue(it.realValue, it.realUnit);

let scaled = '';
if (it.scaledMeters != null && isFinite(it.scaledMeters)) {
  // для baseline додаємо приклад O1 (Волосина (70 мкм)), для O2 — тільки число
  scaled = (it.type === 'baseline')
    ? formatBaselineScaled(it.scaledMeters)
    : fmtMeters(it.scaledMeters);
}


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
  const baseText = formatRequiredBaseline(it.requiredBaselineMeters);
  if (baseText) {
    hint.textContent = ' — ' + t('ui.info_panel.required_baseline') + ': ' + baseText;
    row.appendChild(hint);
  }
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

    panelEl.classList.remove('hidden');
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
    showEmptyState = false;
    return;
  }
  items.length = 0;
  modeLabelState = { modeKey: '', subKey: '' };
  if (modeEl) modeEl.textContent = '';

  showDescriptions = false;
  updateDescSwitch();
  hideHover();
  showEmptyState = false;
  render();
}

export function showEmptyInfoPanelMessage() {
  ensureDom();

  if (items.length > 0) {
    panelEl.classList.remove('hidden');
    return;
  }

  modeLabelState = { modeKey: '', subKey: '' };
  if (modeEl) modeEl.textContent = '';

  showDescriptions = false;
  updateDescSwitch();
  hideHover();

  showEmptyState = true;
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
export function setModeLabelKeys({ modeKey = '', subKey = '' } = {}) {
  ensureDom();
  modeLabelState = {
    modeKey: String(modeKey || ''),
    subKey: String(subKey || '')
  };
  if (modeEl) modeEl.textContent = computeModeLabel();
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


