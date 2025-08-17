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

// ── Захист від сторонніх очищень/видалень шарів
let __hardReset = false; // істинний лише на час повного reset

// Перехоплення методів шарів (clear/removeAll) — щоб самовідновлюватись після «м'яких» клірів
const __patchLayer = (layer) => {
  try {
    if (!layer) return;

    // patch .clear
    if (typeof layer.clear === 'function' && !layer.__patchedClear) {
      const origClear = layer.clear.bind(layer);
      layer.clear = function (...args) {
        const res = origClear(...args);
        try {
          if (!__hardReset) {
            console.warn('[circles] layer.clear detected (soft):', layer?.name || layer);
            try { console.trace(); } catch {}
            requestAnimationFrame(() => { try { __redrawAllFromRegistry(); } catch {} });
          }
        } catch { __redrawAllFromRegistry(); }
        return res;
      };
      layer.__patchedClear = true;
    }

    // patch .removeAll (деякі версії og.es)
    if (typeof layer.removeAll === 'function' && !layer.__patchedRemoveAll) {
      const origRemoveAll = layer.removeAll.bind(layer);
      layer.removeAll = function (...args) {
        const res = origRemoveAll(...args);
        try {
          if (!__hardReset) {
            console.warn('[circles] layer.removeAll detected (soft):', layer?.name || layer);
            try { console.trace(); } catch {}
            requestAnimationFrame(() => { try { __redrawAllFromRegistry(); } catch {} });
          }
        } catch { __redrawAllFromRegistry(); }
        return res;
      };
      layer.__patchedRemoveAll = true;
    }
  } catch {}
};
__patchLayer(circlesLayer);
__patchLayer(labelsLayer);

// Перехоплення методів планети (removeLayer/clearLayers) — щоб повернути шари, якщо їх зняли цілком
(function __patchPlanet() {
  try {
    const planet = globus.planet;

    // позначаємо «жорсткий» reset, щоб не відновлювати під час full-reset
    window.addEventListener('orbit:ui-reset', () => {
      __hardReset = true;
      setTimeout(() => { __hardReset = false; }, 0);
    });

    const readd = () => {
      try { planet.addLayer(circlesLayer); } catch {}
      try { planet.addLayer(labelsLayer); } catch {}
      try { __redrawAllFromRegistry(); } catch {}
    };

    if (planet && typeof planet.removeLayer === 'function' && !planet.__circlesPatchedRemoveLayer) {
      const orig = planet.removeLayer.bind(planet);
      planet.removeLayer = function (layer) {
        const out = orig(layer);
        try {
          if (!__hardReset && (layer === circlesLayer || layer === labelsLayer)) {
            console.warn('[circles] planet.removeLayer on our layer:', layer?.name || layer);
            try { console.trace(); } catch {}
            requestAnimationFrame(readd);
          }
        } catch { readd(); }
        return out;
      };
      planet.__circlesPatchedRemoveLayer = true;
    }

    if (planet && typeof planet.clearLayers === 'function' && !planet.__circlesPatchedClearLayers) {
      const orig = planet.clearLayers.bind(planet);
      planet.clearLayers = function (...args) {
        const out = orig(...args);
        try {
          if (!__hardReset) {
            console.warn('[circles] planet.clearLayers detected');
            try { console.trace(); } catch {}
            requestAnimationFrame(readd);
          }
        } catch { readd(); }
        return out;
      };
      planet.__circlesPatchedClearLayers = true;
    }
  } catch {}
})();

// РЕЄСТР КІЛ
const REG = new Map(); // id -> { id,color,radiusMeters,line,halo,dot,label,nameKey,nameText,anchorDeg }
let _seq = 0;
const mkId = () => `c_${++_seq}`;

// ───────────────────────────────────────────────────────────────────────────────
// Утіліти
const R_EARTH = 6371000; // м
const PI = Math.PI;
const TWO_PI = 2 * PI;
const DEG = 180 / PI;

const rad = (d) => d / DEG;
const deg = (r) => r * DEG;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const normLon = (lon) => {
  // [-180, 180)
  let L = lon;
  while (L < -180) L += 360;
  while (L >= 180) L -= 360;
  return L;
};

// ───────────────────────────────────────────────────────────────────────────────
// Реєстр
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

function setNameKeyById(id, payload) {
  const r = REG.get(id);
  if (!r) return;
  r.nameKey = payload || null;
}

function setLabelTextById(id, text) {
  const r = REG.get(id);
  if (!r || !r.label) return;
  r.nameText = text;
  const le = r.label;
  if (le.label && typeof le.label.setText === 'function') {
    le.label.setText('\u00A0' + (text || ''));
  }
}

function clearRegistry() {
  REG.clear();
}

// «Сховати» попередні entity запису без remove/clear
function __clearRecEntities(rec) {
  try {
    if (rec.line && typeof rec.line.setVisibility === 'function')  { try { rec.line.setVisibility(false); } catch {} }
    if (rec.halo && typeof rec.halo.setVisibility === 'function')  { try { rec.halo.setVisibility(false); } catch {} }
    if (rec.dot  && typeof rec.dot.setVisibility === 'function')   { try { rec.dot.setVisibility(false); } catch {} }
    if (rec.label&& typeof rec.label.setVisibility === 'function') { try { rec.label.setVisibility(false); } catch {} }
  } catch {}
  rec.line = null;
  rec.halo = null;
  rec.dot = null;
  rec.label = null;
}

// Якщо шари спорожніли/відсутні — повернути їх і перемалювати з реєстру
function __ensureLayersSynced() {
  try {
    // гарантуємо, що шари підключені до планети
    try { globus.planet.addLayer(circlesLayer); } catch {}
    try { globus.planet.addLayer(labelsLayer); }  catch {}

    const cEmpty = !circlesLayer.getEntities || circlesLayer.getEntities().length === 0;
    const lEmpty = !labelsLayer.getEntities || labelsLayer.getEntities().length === 0;
    if ((cEmpty || lEmpty) && REG.size > 0) __redrawAllFromRegistry();
  } catch {}
}

// ───────────────────────────────────────────────────────────────────────────────
// Центр
function __getCurrentCenter() {
  const entities = markerLayer.getEntities();
  if (entities.length) {
    const ll = entities[entities.length - 1].getLonLat();
    return { lon: ll.lon, lat: ll.lat };
  }
  placeMarker(defaultCenterLon, defaultCenterLat, { silent: true, suppressEvent: true });
  return { lon: defaultCenterLon, lat: defaultCenterLat };
}

// ───────────────────────────────────────────────────────────────────────────────
// Імена
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
// Геодезичне коло на сфері (forward geodesic, істинне до антиподу)
function getGeodesicCirclePoints(lonDeg, latDeg, radiusMeters, segmentsHint = 256) {
  const φ1 = rad(latDeg);
  const λ1 = rad(lonDeg);

  // Кутова відстань
  let δ = radiusMeters / R_EARTH;
  δ = clamp(δ, 0, PI);

  // Виродження в антипод
  const EPS = 1e-8;
  if (PI - δ <= EPS) {
    return { coords: [], isAntipode: true, antipode: [normLon(lonDeg + 180), -latDeg] };
  }

  // Щільність сегментів пропорційна довжині кола
  const seg = clamp(Math.round(64 + (segmentsHint - 64) * (δ / PI)), 64, segmentsHint);
  const coords = [];
  const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ),   cosδ  = Math.cos(δ);

  for (let i = 0; i <= seg; i++) {
    const θ = (i / seg) * TWO_PI; // азимут
    const cosθ = Math.cos(θ),   sinθ  = Math.sin(θ);

    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * cosθ;
    const φ2 = Math.asin(clamp(sinφ2, -1, 1));

    const y = sinθ * sinδ * cosφ1;
    const x = cosδ - sinφ1 * Math.sin(φ2);
    const λ2 = λ1 + Math.atan2(y, x);

    const lat2 = deg(φ2);
    const lon2 = normLon(deg(λ2));
    coords.push([lon2, lat2]);
  }
  return { coords, isAntipode: false, antipode: null };
}

// ───────────────────────────────────────────────────────────────────────────────
// Рознесення підписів
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
  const degShift = LABEL_BASE_DEG * (bucket + 1);  // 24°, 48°, ..., 144°
  const step = Math.max(1, Math.round(n * (degShift / 360)));
  return (bestIdx + step) % n;
}

// ───────────────────────────────────────────────────────────────────────────────
// Малювання одного запису
function __drawRecord(rec) {
  if (!rec || !Number.isFinite(rec.radiusMeters) || rec.radiusMeters <= 0) return;

  const { lon, lat } = __getCurrentCenter();
  const { coords, isAntipode, antipode } = getGeodesicCirclePoints(lon, lat, rec.radiusMeters, 320);

  if (isAntipode) {
    const anchor = antipode;

    // Крапка
    const svgDot = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><circle cx='6' cy='6' r='5' fill='${rec.color}'/></svg>`;
    const dotEntity = new Entity({
      lonlat: anchor,
      billboard: {
        src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svgDot),
        size: [12, 12],
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
        offset: [6, 0]
      }
    });
    labelsLayer.add(labelEntity);

    rec.dot = dotEntity;
    rec.label = labelEntity;

    if (typeof rec.nameText === 'string' && rec.nameText.length) {
      setLabelTextById(rec.id, rec.nameText);
    } else if (rec.nameKey) {
      const txt = __resolveNameFromKey(rec.nameKey);
      if (txt) setLabelTextById(rec.id, txt);
    }

    return; // Лінію не малюємо — це точка антиподу
  }

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

// ───────────────────────────────────────────────────────────────────────────────
// API
export function addGeodesicCircle(radiusMeters, color = 'rgba(255,0,0,0.8)', id = null) {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return null;

  // Якщо хтось до цього очистив/зняв шари — відновимо перед додаванням
  __ensureLayersSynced();

  const existed = !!(id && REG.has(id));
  const rec = upsertById({ id, color, radiusMeters });

  // Якщо це оновлення існуючого запису (той самий id) — сховаємо попередні ентіті без remove/clear
  if (existed) {
    __clearRecEntities(rec);
  }

  __drawRecord(rec);

  // підстрахуємось від можливого стороннього кліру у цьому ж тіку
  try { requestAnimationFrame(() => { try { __ensureLayersSynced(); } catch {} }); } catch { __ensureLayersSynced(); }
  return rec.id;
}

// Сумісність з існуючими імпортами
export function setCircleLabelTextById(id, text) { setLabelTextById(id, text); }
export function setCircleLabelText(id, text) { setLabelTextById(id, text); }

export function setCircleLabelKeyById(id, payload) {
  setNameKeyById(id, payload);
  const rec = REG.get(id);
  if (!rec) return;
  let txt = '';
  if (payload?.type === 'lib') {
    txt = __resolveNameFromKey(payload);
  } else if (payload?.type === 'custom') {
    txt = payload.customName || rec.nameText || '';
  }
  if (txt) setLabelTextById(rec.id, txt);
}

// ───────────────────────────────────────────────────────────────────────────────
// Перемальовка / скидання
function __redrawAllFromRegistry() {
  for (const rec of REG.values()) {
    try { __clearRecEntities(rec); __drawRecord(rec); }
    catch (e) { console.error('[circles] redraw failed', e); }
  }
}

function __fullClear() {
  try { circlesLayer.clear(); } catch {}
  try { labelsLayer.clear(); } catch {}
  clearRegistry();
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

// Опційне відновлення після часткового очищення екрана
window.addEventListener('orbit:screen-partial-cleared', () => {
  try { requestAnimationFrame(__ensureLayersSynced); } catch { __ensureLayersSynced(); }
});

window.addEventListener('orbit:ui-reset', __fullClear);
