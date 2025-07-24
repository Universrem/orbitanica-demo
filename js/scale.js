// js/scale.js
// ──────────────────────────────────────────────
// Розрахунок радіусів (м) для двох кіл за реальними значеннями й базовим діаметром.

export function calcRadii({ mode, realDiam1_km, realParam2_km, circle1_m }) {
  const radius1_m = circle1_m / 2;                      // радіус першого кола, як є
  const scale      = circle1_m / (realDiam1_km * 1_000); // м / м → безрозмірний

  let radius2_m;
  if (mode === 'diameter') {
    // realParam2_km — це діаметр об’єкта 2
    radius2_m = (realParam2_km * 1_000) * scale / 2;
  } else if (mode === 'distance') {
    // realParam2_km — це відстань Земля–об’єкт 2
    radius2_m = (realParam2_km * 1_000) * scale;        // відстань = радіус, без /2
  } else {
    console.error(`[scale] Невідомий режим "${mode}"`);
    radius2_m = radius1_m;
  }

  return [radius1_m, radius2_m];
}
