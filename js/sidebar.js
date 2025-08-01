// js/sidebar.js
// ─────────────────────────────────────────────────────────────
// Створює кнопки-порівняння, масштабує радіуси та малює кола.

'use strict';

import { initInfoPanel, showInfo, hideInfo } from './infoPanel.js';
import { toKilometres }           from './converter.js';
import { calcRadii }              from './scale.js';          // тільки diameter / distance
import { drawTwoCircles, drawThreeCircles }         from './globe-main.js';
import { t, getCurrentLang }      from './i18n.js';
import { comparisons }            from './comparisons.js';
import { formatNice }             from './formatNice.js';
import { markerLayer, defaultCenterLat, defaultCenterLon } from './globe-main.js';
import { LonLat, Entity } from '../lib/og.es.js';


/*──────────────── Допоміжні ───────────────────────────────*/
const locName = obj => {
  const lang = getCurrentLang();              // 'ua' | 'en' | 'es'
  return obj[`name_${lang}`] || obj.name_en || obj.name || '—';
};

const fmtNice = m => {                        // { val, unitKey } → { val, unit }
  const f = formatNice(m);
  return { val: f.val, unit: t(f.unitKey) };
};

const formatRawNumber = (val, unitKey) => {
  return {
    val    : val.toLocaleString('uk-UA'),
    unitKey: 'unit.' + unitKey
  };
};


const fmtVal = n => {
  if (n >= 1e9) return { val: (n / 1e9).toFixed(2), unitKey: 'unit.billion' };
  if (n >= 1e6) return { val: (n / 1e6).toFixed(2), unitKey: 'unit.million' };
  if (n >= 1e3) return { val: (n / 1e3).toFixed(2), unitKey: 'unit.thousand' };
  return { val: n.toString(), unitKey: '' };
};


/*──────────────── Ініціалізація ───────────────────────────*/
let activeId = null;

export async function initSidebar() {
  initInfoPanel();
  hideInfo();

  const bar = document.getElementById('sidebar');
  if (!bar) { console.error('[sidebar] #sidebar не знайдено'); return; }

  /*── Завантажуємо дані ──*/
  let objects = [];
  try {
  const [
    univ,
    geo,
    history,
    mathematics,
    money,
    biology
  ] = await Promise.all([
    fetch('./data/univers.json'  ).then(r => r.json()),
    fetch('./data/geography.json').then(r => r.json()),
    fetch('./data/history.json'  ).then(r => r.json()),
    fetch('./data/mathematics.json').then(r => r.json()),
    fetch('./data/money.json'     ).then(r => r.json()),
    fetch('./data/biology.json'   ).then(r => r.json())
  ]);

  // об’єднуємо всі шість масивів у єдиний
  objects = [
    ...univ,
    ...geo,
    ...history,
    ...mathematics,
    ...money,
    ...biology
  ];
} catch (e) {
  console.error('[sidebar] Помилка завантаження об’єктів', e);
  return;
}


  const findObj = n =>
    objects.find(o => o.name_en === n || o.id === n || o.name === n);

  const highlight = () => {
  bar.querySelectorAll('.comparison-item')
     .forEach(item => item.classList.toggle('active', item.dataset.id === activeId));
};


  /*──────────────── Кнопка ───────────────────────────────*/
  function createButton(cfg) {
  const li = document.createElement('li');
  li.className = 'comparison-item';
  li.dataset.id = cfg.id;
  li.textContent = t(cfg.key);

  li.addEventListener('click', () => {
    hideInfo();

    // Якщо користувач ще не ставив мітку – ставимо її в центр Львова
if (markerLayer.getEntities().length === 0) {
  const autoMarker = new Entity({
    name     : 'Default marker',
    lonlat   : new LonLat(defaultCenterLon, defaultCenterLat),
    billboard: { src: './res/marker.png', size: [16, 24], offset: [0, 12] }
  });
  markerLayer.add(autoMarker);
}


    const o1 = findObj(cfg.obj1);
    const o2 = findObj(cfg.obj2);
    let o3 = null;
    if (cfg.type === 'time') {
      o3 = findObj(cfg.obj3);
    }

    if (!o1 || !o2 || (cfg.type === 'time' && !o3)) {
      console.error('[sidebar] Не знайдено', cfg.obj1, cfg.obj2, cfg.obj3);
      return;
    }

    const obj1Name = locName(o1);
    const obj2Name = locName(o2);
    let obj3Name = '';
    if (cfg.type === 'time') {
      obj3Name = locName(o3);
    }

    let r1_m, r2_m, r3_m, info = {};

    /*────── diameter ───────────────────────────────*/
    if (cfg.type === 'diameter') {
      const d1_km = toKilometres(o1.diameter.value, o1.diameter.unit);
      const d2_km = toKilometres(o2.diameter.value, o2.diameter.unit);

      [r1_m, r2_m] = calcRadii({
        mode: 'diameter', realDiam1_km: d1_km, realParam2_km: d2_km, circle1_m: cfg.circle1
      });

      drawTwoCircles(r1_m, r2_m, cfg.marker1, cfg.marker2);

      info = {
        type: 'diameter',
        real1_m   : d1_km * 1000,
        real2_m   : d2_km * 1000,
        scaled1_m : r1_m * 2,
        scaled2_m : r2_m * 2
      };
    }

    /*────── distance ───────────────────────────────*/
    else if (cfg.type === 'distance') {
      const d1_km = toKilometres(o1.diameter.value, o1.diameter.unit);
      const dist2_km = toKilometres(o2.distance_to_earth.value, o2.distance_to_earth.unit);

      [r1_m, r2_m] = calcRadii({
        mode: 'distance', realDiam1_km: d1_km, realParam2_km: dist2_km, circle1_m: cfg.circle1
      });

      drawTwoCircles(r1_m, r2_m, cfg.marker1, cfg.marker2);

      info = {
        type: 'distance',
        real1_m   : d1_km * 1000,
        real2_m   : dist2_km * 1000,
        scaled1_m : r1_m * 2,
        scaled2_m : r2_m
      };
    }

    /*────── value (населення, площа, …) ────────────*/
    else if (cfg.type === 'value') {
  const f  = cfg.field;
  const v1 = o1[f].value;
  const v2 = o2[f].value;
  const u1 = o1[f].unit;
  const u2 = o2[f].unit;
  if (u1 !== u2) {
    console.warn('[sidebar] Різні одиниці – відхилено');
    return;
  }

  r1_m = cfg.circle1 / 2;

// 🔧 Площа масштабування для кількості, грошей, населення, площі
if (f === 'money' || f === 'population' || f === 'quantity' || f === 'area') {
  r2_m = r1_m * Math.sqrt(v2 / v1);
} else {
  r2_m = r1_m * (v2 / v1); // звичайне лінійне масштабування
}


  drawTwoCircles(r1_m, r2_m, cfg.marker1, cfg.marker2);

  const V1 = formatRawNumber(v1, u1);
  const V2 = formatRawNumber(v2, u2);
  const S1 = formatNice(r1_m * 2);
  const S2 = formatNice(r2_m * 2);

  info = {
    type : 'value',
    field: t('field.' + f),
    unit : t(V1.unitKey),
    v1   : { val: V1.val, unit: V1.unitKey },
    v2   : { val: V2.val, unit: V2.unitKey },
    s1   : { val: S1.val, unit: S1.unitKey },
    s2   : { val: S2.val, unit: S2.unitKey }
  };
}


    /*────── time ───────────────────────────────────*/
    else if (cfg.type === 'time') {
      const y1 = o1.time_start.value;
      const y2 = o2.time_start.value;
      const y3 = o3.time_start.value;

      const years1 = Math.abs(2025 - y1);
      const years2 = Math.abs(2025 - y2);
      const years3 = Math.abs(2025 - y3);

      r1_m = cfg.circle1 / 2;
      r2_m = r1_m * (years2 / years1);
      r3_m = r1_m * (years3 / years1);

      drawThreeCircles(r1_m, r2_m, r3_m, cfg.marker1, cfg.marker2, cfg.marker3);

      const Y1 = fmtVal(years1);
const Y2 = fmtVal(years2);
const Y3 = fmtVal(years3);

info = {
  type      : 'time',
  real1_yr  : `${Y1.val} ${t(Y1.unitKey)}`,
  real2_yr  : `${Y2.val} ${t(Y2.unitKey)}`,
  real3_yr  : `${Y3.val} ${t(Y3.unitKey)}`,
  scaled1_m : r1_m,
  scaled2_m : r2_m,
  scaled3_m : r3_m
};

    }

    showInfo({
      title: t(cfg.key),
      obj1Name,
      obj2Name,
      obj3Name,
      ...info
    });

    activeId = cfg.id;
    highlight();
  });

  return li;
}


  /*──────────────── Рендер ───────────────────────────────*/
/*──────────────── Рендер ───────────────────────────────*/
const renderButtons = () => {
  const old = bar.querySelector('#category-list');
  if (old) old.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'category-list';

  comparisons.forEach(category => {
    const catDiv = document.createElement('div');
    catDiv.className = 'category-block';

    const catTitle = document.createElement('div');
    catTitle.className = 'category-title';
    catTitle.textContent = category[`label_${getCurrentLang()}`] || category.label_en;
    catDiv.appendChild(catTitle);

    const list = document.createElement('ul');
    list.className = 'comparison-sublist';

    category.items.forEach(pair => {
      const li = createButton(pair);
      list.appendChild(li);
    });

    //catTitle.addEventListener('click', () => {
    //  list.classList.toggle('hidden');
    //});

    catDiv.appendChild(list);
    wrapper.appendChild(catDiv);
  });

  bar.appendChild(wrapper);
  highlight();
};



  renderButtons();
  document.addEventListener('languageChanged', renderButtons);
}










