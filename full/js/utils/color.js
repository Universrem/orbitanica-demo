// full/js/utils/color.js
'use strict';

// Простий менеджер кольорів: стабільний колір на ключ (ім'я/ID об'єкта).
const colorMap = new Map();
let idx = 0;

// HSL → RGBA
function hslToRgbaString(h, s, l, a = 0.95) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;

  if (0 <= hp && hp < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (1 <= hp && hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (2 <= hp && hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (3 <= hp && hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (4 <= hp && hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else if (5 <= hp && hp < 6) { r1 = c; g1 = 0; b1 = x; }

  const m = l - c / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return `rgba(${r},${g},${b},${a})`;
}

// Рівномірна розкладка відтінків (золотий кут)
function nextColor() {
  const hue = (idx * 137.508) % 360;
  idx++;
  return hslToRgbaString(hue, 85, 55, 0.95);
}

export function getColorForKey(key) {
  const k = String(key ?? `auto_${idx}`);
  if (colorMap.has(k)) return colorMap.get(k);
  const c = nextColor();
  colorMap.set(k, c);
  return c;
}

// Повний reset — скидати відповідність ключ→колір
window.addEventListener('orbit:ui-reset', () => {
  colorMap.clear();
  idx = 0;
});
