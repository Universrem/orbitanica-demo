// full/js/globe/circles.js
'use strict';

import { markerLayer, globus, defaultCenterLat, defaultCenterLon, labelsLayer } from "./globe.js";

import { Entity, Vector, LonLat } from '../../lib/og.es.js';

import { placeMarker } from "./markers.js";

// Шар для всіх геодезичних кіл
export const circlesLayer = new Vector("circlesLayer", { visibility: true });
globus.planet.addLayer(circlesLayer);

// === Лейбли для кіл (OG labels) ============================================
const labelByColor = new Map(); // color -> Entity (label)
const dotByColor   = new Map(); // color -> Entity (dot)
const nameByColor  = new Map(); // color -> string (назва)

// Оновити текст у лейблі за кольором
export function setCircleLabelText(color, text) {
  nameByColor.set(color, text);
  const le = labelByColor.get(color);
  if (!le) return;
  if (le.label && typeof le.label.setText === 'function') {
    le.label.setText('\u00A0' + text);
  } else if (typeof le.setLabel === 'function') {
    le.setLabel({ ...(le.label || {}), text: '\u00A0' + text });
  } else {
    const ll = le.lonlat || le._lonlat || le._lonLat; // fallback на полі lonlat
    const newLe = new Entity({
      lonlat: ll,
      label: { ...(le.label || {}), text: '\u00A0' + text }
    });
    try { labelsLayer.remove(le); } catch(e){}
    labelsLayer.add(newLe);
    labelByColor.set(color, newLe);
  }
}


// === Рознесення підписів по колу (більший кут) ==============================
const LABEL_BASE_DEG = 24; // якщо треба — підніми на 30/36

function __hashColor(str) {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function __pickAnchorWithOffset(coords, color) {
  if (!Array.isArray(coords) || !coords.length) return coords?.[0];

  // знайти "верх" на екрані
  let bestIdx = 0, bestY = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const ll = coords[i];
    const p = globus.planet.getPixelFromLonLat(new LonLat(ll[0], ll[1]));
    if (p && p.y < bestY) { bestY = p.y; bestIdx = i; }
  }

  // кутовий крок від кольору (розносимо схожі кола)
  const n = coords.length;
  const bucket = __hashColor(color) % 6;      // 0..5
  const deg = LABEL_BASE_DEG * (bucket + 1);  // 24°, 48°, ..., 144°
  const step = Math.max(1, Math.round(n * (deg / 360)));
  return coords[(bestIdx + step) % n];
}
// ============================================================================



// === МОДЕЛЬ НАМАЛЬОВАНИХ КІЛ (для перевимальовування при зміні центра) ===
const __circlesModel = []; // елементи { radiusMeters:number, color:string }

// Актуальний центр: з маркера; якщо маркера немає — ставимо у Львів (без руху камери)
function __getCurrentCenter() {
  const entities = markerLayer.getEntities();
  if (entities.length) {
    const ll = entities[entities.length - 1].getLonLat();
    return { lon: ll.lon, lat: ll.lat };
  }
  // Ставимо маркер у Львові без руху камери й повертаємо цей центр
  placeMarker(defaultCenterLon, defaultCenterLat, { silent: true, suppressEvent: true });
  return { lon: defaultCenterLon, lat: defaultCenterLat };
}

/**
 * Обчислює точки геодезичного кола на сфері (апроксимація для невеликих радіусів).
 */
function getCirclePointsSphere(lon, lat, radiusMeters, segments = 64) {
  const coords = [];
  const R = 6371000;

  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);

    const newLat = latRad + (dy / R);
    const newLon = lonRad + (dx / (R * Math.cos(latRad)));

    coords.push([newLon * 180 / Math.PI, newLat * 180 / Math.PI]);
  }
  return coords;
}

/**
 * Додає геодезичне коло навколо поточного маркера.
 * _isRedraw — внутрішній прапорець, щоб не дублювати запис у модель при перевимальовуванні.
 */
export function addGeodesicCircle(radiusMeters, color = 'rgba(255,0,0,0.8)', _isRedraw = false) {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return;

  // Зберігаємо в модель тільки при «звичайному» додаванні
  if (!_isRedraw) {
    __circlesModel.push({ radiusMeters, color });
  }

  const { lon, lat } = __getCurrentCenter();
  const coords = getCirclePointsSphere(lon, lat, radiusMeters);

  const haloEntity = new Entity({
  geometry: {
    type: "LineString",
    coordinates: coords,
    style: {
      lineColor: "rgba(0,0,0,0.35)", // темно-сіра напівпрозора «тінь»
      lineWidth: 7                   // трохи ширше за основну лінію
    }
  }
});
circlesLayer.add(haloEntity);        // ДОДАЄМО ТІНЬ ПЕРШОЮ (внизу)

const circleEntity = new Entity({
  geometry: {
    type: "LineString",
    coordinates: coords,
    style: {
      lineColor: color,              // ваш індивідуальний колір
      lineWidth: 5
    }
  }
});
circlesLayer.add(circleEntity);      // ОСНОВНЕ КОЛО ЗВЕРХУ

// === OG-лейбли: якір з кутовим зсувом + кольорова крапка ===
const anchor = __pickAnchorWithOffset(coords, color);

// 1) кольорова КРАПКА як billboard (SVG), гарантовано видно у будь-якому шрифті
const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'>
  <circle cx='5' cy='5' r='4' fill='${color}' />
</svg>`;

const dotEntity = new Entity({
  lonlat: anchor,
  billboard: {
    src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg),
    size: [10, 10],
    offset: [0, 0]   // трохи лівіше від якоря
  }
});
labelsLayer.add(dotEntity);
dotByColor.set(color, dotEntity);


// 2) текст (чорний, без тіні), з невеликим «відступом» через NBSP
const labelEntity = new Entity({
  lonlat: anchor,
  label: {
    text: "\u00A0",   // ім'я підставиться setCircleLabelText(...)
    size: 11,
    color: "#111",
    outline: 0,       // БЕЗ ТІНІ
    align: "left",
    offset: [4, 0]  
  }
});
labelsLayer.add(labelEntity);
labelByColor.set(color, labelEntity);
// якщо для цього кольору вже є назва — підставити її
const savedName = nameByColor.get(color);
if (savedName) {
  if (labelEntity.label && typeof labelEntity.label.setText === 'function') {
    labelEntity.label.setText('\u00A0' + savedName);
  } else if (typeof labelEntity.setLabel === 'function') {
    labelEntity.setLabel({ ...(labelEntity.label || {}), text: '\u00A0' + savedName });
  }
}

}

function __redrawAllCircles() {
  try { circlesLayer.clear(); } catch (e) {}
  try { labelsLayer.clear(); } catch (e) {}
  labelByColor.clear();
  dotByColor.clear();

  __circlesModel.forEach(c => {
    try { addGeodesicCircle(c.radiusMeters, c.color, /* _isRedraw */ true); }
    catch (e) { console.error('[circles redraw] failed:', e); }
  });
}

// Події
// Центр змінено (маркер пересунули) → перевимальовуємо всі кола
window.addEventListener('orbit:center-changed', __redrawAllCircles);

// Глобальний reset UI → чистимо модель (шар очищається в reset.js)
window.addEventListener('orbit:ui-reset', () => {
  __circlesModel.length = 0;
  try { circlesLayer.clear(); } catch (e) {}
  try { labelsLayer.clear(); } catch (e) {}
  labelByColor.clear();
  dotByColor.clear();
  nameByColor.clear();

});




