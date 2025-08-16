// full/js/globe/circleRegistry.js
'use strict';

// id → запис кола
const CIRCLES = new Map();
// колір → id (для зворотної сумісності поки не приберемо кольори з API)
const COLOR_TO_ID = new Map();
let _seq = 0;
const mkId = () => `c_${++_seq}`;

export function clearRegistry() {
  CIRCLES.clear();
  COLOR_TO_ID.clear();
}

// Створення/оновлення запису для КОЛЬОРУ (поки мігруємо на ID)
export function upsertByColor({ color, line, dot, label, nameKey = null, nameText = null, anchorAngle = 0 }) {
  let id = COLOR_TO_ID.get(color);
  if (!id) {
    id = mkId();
    COLOR_TO_ID.set(color, id);
  }
  const prev = CIRCLES.get(id) || {};
  const rec = {
    id, color,
    line: line || prev.line || null,
    dot: dot || prev.dot || null,
    label: label || prev.label || null,
    nameKey: nameKey ?? prev.nameKey ?? null,
    nameText: nameText ?? prev.nameText ?? null,
    anchorAngle: anchorAngle || prev.anchorAngle || 0
  };
  CIRCLES.set(id, rec);
  return id;
}

export function getById(id) { return CIRCLES.get(id) || null; }
export function getIdByColor(color) { return COLOR_TO_ID.get(color) || null; }
export function setNameKeyById(id, key) { const r = CIRCLES.get(id); if (r) r.nameKey = key; }
export function setNameKeyByColor(color, key) { const id = getIdByColor(color); if (id) setNameKeyById(id, key); }

export function setLabelEntityById(id, labelEnt) { const r = CIRCLES.get(id); if (r) r.label = labelEnt; }
export function setDotEntityById(id, dotEnt) { const r = CIRCLES.get(id); if (r) r.dot = dotEnt; }
export function setLineEntityById(id, lineEnt) { const r = CIRCLES.get(id); if (r) r.line = lineEnt; }

export function setLabelTextById(id, text) {
  const r = CIRCLES.get(id); if (!r || !r.label) return;
  r.nameText = text;
  const le = r.label;
  if (typeof le.setLabel === 'function') {
    le.setLabel({ ...(le.label || {}), text: '\u00A0' + (text || '') });
  } else if (le.label && typeof le.label.setText === 'function') {
    le.label.setText('\u00A0' + (text || ''));
  }
}
export function setLabelTextByColor(color, text) {
  const id = getIdByColor(color); if (id) setLabelTextById(id, text);
}

// Викликати при зміні мови: поверни функцію-резольвер з i18n і онови всі
export function refreshAllLabels(resolveNameByKey /* (key)=>string */) {
  for (const r of CIRCLES.values()) {
    const txt = r.nameKey ? resolveNameByKey(r.nameKey) : r.nameText;
    if (txt != null) setLabelTextById(r.id, txt);
  }
}

// Для перескладання позицій (центр змінився): віддай ітератор
export function *iterateCircleRecords() { yield* CIRCLES.values(); }
