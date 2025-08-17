// full/js/globe/circles.js
'use strict';

import { markerLayer, globus, defaultCenterLat, defaultCenterLon, labelsLayer } from "./globe.js";
import { Entity, Vector, LonLat } from '../../lib/og.es.js';
import { placeMarker } from "./markers.js";
import { getUniverseLibrary } from '../data/data_diameter.js';
import { getCurrentLang } from '../i18n.js';

// ───────────────────────────────────────────────────────────────────────────────
// Шар кіл
export const circlesLayer = new Vector("circlesLayer", { visibility: true });
globus.planet.addLayer(circlesLayer);

// РЕЄСТР КІЛ: тільки id → запис (колір — це стиль, НЕ ключ)
const REG = new Map();           // id -> { id,color,radiusMeters,line,halo,dot,label,nameKey,nameText,anchorDeg }
let _seq = 0;
const mkId = () => `c_${++_seq}`;

// Створення/оновлення запису по id
function upsertById({ id = null, color, radiusMeters = null, line = null, halo = null, dot = null, label = null, nameKey = null, nameText = null, anchorDeg = null }) {
  if (!id) id = mkId();
  const prev = REG.get(id) || {};
  const rec = {
    id,
    color,
    radiusMeters: radiusMeters ?? prev.radiusMeters ?? 0,
    line: line ?? prev.line ?? null,
    halo: halo ?? prev.halo ?? null,
    dot: dot ?? prev.dot ?? null,
    label: label ?? prev.label ?? null,
    nameKey: nameKey ?? prev.nameKey ?? null,
    nameText: nameText ?? prev.nameText ?? null,
    anchorDeg: anchorDeg ?? prev.anchorDeg ?? 0
  };
  REG.set(id, rec);
  return rec;
}


function setNameKeyById(id, payload /* {type:'lib'|'custom', libIndex?, customName?} */) {
  const r = REG.get(id);
  if (!r) return;
  r.nameKey = payload || null;
}


function setLabelTextById(id, text) {
  const r = REG.get(id);
  if (!r || !r.label) return;
  r.nameText = text;
  const le = r.label;
  // ОНОВЛЮЄМО ЛИШЕ ЧЕРЕЗ API ЛЕЙБЛА; НЕ ВИКЛИКАТИ entity.setLabel(...)
  if (le.label && typeof le.label.setText === 'function') {
    le.label.setText('\u00A0' + (text || ''));
  }
}
function clearRegistry() {
  REG.clear();
}


// ───────────────────────────────────────────────────────────────────────────────
// Геометрія
function __getCurrentCenter() {
  const entities = markerLayer.getEntities();
  if (entities.length) {
    const ll = entities[entities.length - 1].getLonLat();
    return { lon: ll.lon, lat: ll.lat };
  }
  // Ставимо маркер у дефолт і повертаємо центр
  placeMarker(defaultCenterLon, defaultCenterLat, { silent: true, suppressEvent: true });
  return { lon: defaultCenterLon, lat: defaultCenterLat };
}

/** Обчислює точки геодезичного кола (апроксимація для невеликих радіусів). */
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

// Рознесення підписів по дузі
const LABEL_BASE_DEG = 24;
function __hashColor(str) {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function __pickAnchorIndex(coords, color) {
  if (!Array.isArray(coords) || !coords.length) return 0;
  let bestIdx = 0, bestY = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const ll = coords[i];
    const p = globus.planet.getPixelFromLonLat(new LonLat(ll[0], ll[1]));
    if (p && p.y < bestY) { bestY = p.y; bestIdx = i; }
  }
  const n = coords.length;
  const bucket = __hashColor(color) % 6;      // 0..5
  const deg = LABEL_BASE_DEG * (bucket + 1);  // 24°, 48°, ..., 144°
  const step = Math.max(1, Math.round(n * (deg / 360)));
  return (bestIdx + step) % n;
}

// ───────────────────────────────────────────────────────────────────────────────
// Малювання одного запису (створює/оновлює entity згідно з поточним центром)
function __drawRecord(rec) {
  if (!rec || !Number.isFinite(rec.radiusMeters) || rec.radiusMeters <= 0) return;

  const { lon, lat } = __getCurrentCenter();
  const coords = getCirclePointsSphere(lon, lat, rec.radiusMeters);

  // Halo
  const haloEntity = new Entity({
    geometry: {
      type: "LineString",
      coordinates: coords,
      style: {
        lineColor: "rgba(0,0,0,0.35)",
        lineWidth: 7
      }
    }
  });
  circlesLayer.add(haloEntity);

  // Основне коло
  const circleEntity = new Entity({
    geometry: {
      type: "LineString",
      coordinates: coords,
      style: {
        lineColor: rec.color,
        lineWidth: 5
      }
    }
  });
  circlesLayer.add(circleEntity);

  // Якір
  const anchorIdx = __pickAnchorIndex(coords, rec.color);
  const anchor = coords[anchorIdx];

  // Крапка
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><circle cx='5' cy='5' r='4' fill='${rec.color}'/></svg>`;
  const dotEntity = new Entity({
    lonlat: anchor,
    billboard: {
      src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg),
      size: [10, 10],
      offset: [0, 0]
    }
  });
  labelsLayer.add(dotEntity);

  // Лейбл
  const labelEntity = new Entity({
    lonlat: anchor,
    label: {
      text: "\u00A0",
      size: 11,
      color: "#111",
      outline: 0,
      align: "left",
      offset: [4, 0]
    }
  });
  labelsLayer.add(labelEntity);

  // Оновити запис зв’язками
  rec.line = circleEntity;
  rec.halo = haloEntity;
  rec.dot = dotEntity;
  rec.label = labelEntity;

  // Початковий текст
  if (typeof rec.nameText === 'string' && rec.nameText.length) {
    setLabelTextById(rec.id, rec.nameText);
  } else if (rec.nameKey) {
    const txt = __resolveNameFromKey(rec.nameKey);
    if (txt) setLabelTextById(rec.id, txt);
  }
}

export function addGeodesicCircle(radiusMeters, color = 'rgba(255,0,0,0.8)', id = null) {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return null;
  const rec = upsertById({ id, color, radiusMeters });
  __drawRecord(rec);
  return rec.id;
}

export function setCircleLabelTextById(id, text) {
  setLabelTextById(id, text);
}

export function setCircleLabelKeyById(id, payload) {
  // payload: { type:'lib', libIndex } | { type:'custom', customName }
  setNameKeyById(id, payload);
  const rec = REG.get(id);
  if (!rec) return;
  let txt = '';
  if (payload?.type === 'lib') {
    txt = __resolveNameFromKey(payload);
  } else if (payload?.type === 'custom') {
    txt = payload.customName || rec.nameText || '';
  }
  if (txt) setLabelTextById(id, txt);
}

// ───────────────────────────────────────────────────────────────────────────────
// Перемальовка при зміні центру
function __redrawAllFromRegistry() {
  try { circlesLayer.clear(); } catch (e) {}
  try { labelsLayer.clear(); } catch (e) {}
  for (const rec of REG.values()) {
    __drawRecord(rec);
  }
}

// Повний reset
function __fullClear() {
  try { circlesLayer.clear(); } catch (e) {}
  try { labelsLayer.clear(); } catch (e) {}
  clearRegistry();
}

// ───────────────────────────────────────────────────────────────────────────────
// Текст за ключем
function __resolveNameFromKey(payload) {
  try {
    if (!payload) return '';
    if (payload.type === 'custom') return payload.customName || '';
    if (payload.type === 'lib') {
      const lib = getUniverseLibrary();
      const lang = getCurrentLang?.() || 'ua';
      const rec = lib?.[payload.libIndex];
      return rec ? (rec[`name_${lang}`] ?? rec.name_en ?? '') : '';
    }
    return '';
  } catch {
    return '';
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Події
window.addEventListener('orbit:center-changed', __redrawAllFromRegistry);

const __onLangChange = () => {
  for (const rec of REG.values()) {
    let txt = '';
    if (rec.nameKey) txt = __resolveNameFromKey(rec.nameKey);
    else txt = rec.nameText || '';
    if (txt) setLabelTextById(rec.id, txt);
  }
};
document.addEventListener('languageChanged', __onLangChange);
window.addEventListener('orbit:lang-change', __onLangChange);

window.addEventListener('orbit:ui-reset', __fullClear);




