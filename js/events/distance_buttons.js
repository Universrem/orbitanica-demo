'use strict';

/**
 * Еталонний обробник для режиму «Відстань».
 * Контракт:
 *   1) бере StandardData з адаптера;
 *   2) задає baseline у калькуляторі;
 *   3) додає коло для О2 через калькулятор (лінійний масштаб);
 *   4) викликає системні рендери кіл та інфопанель.
 *   5) Акумулює вибрані О2 у стабільному вигляді для серіалізатора (з snapshot).
 */

import { getDistanceData } from '../data/data_distance.js';
import { setDistanceBaseline, addDistanceCircle, resetDistanceScale } from '../calc/calculate_distance.js';
import { addGroup, appendVariant, setGroupDescription, setModeLabelKeys } from '../ui/infoPanel.js';
import { getColorForKey } from '../utils/color.js';
import {
  addGeodesicCircle,
  setCircleLabelTextById,
} from '../globe/circles.js';

/* ───────────────────────── СТАН ДЛЯ СЦЕНИ ───────────────────────── */

// Лічильник для унікальних id кіл О2 (скидається на UI-RESET)
let distanceResultSeq = 0;

// Стабільний список вибраних О2 для серіалізатора
// Формат елемента:
// { categoryKey: string|null, objectId: string|null, name: string|null, snapshot?: { id, category_key, value, unit, ... } }
const __distanceSelectedO2s = [];

/* ───────────────────────── ХЕЛПЕРИ ДЛЯ SNAPSHOT ───────────────────────── */

// Безпечний парсер JSON
function __safeParse(j) { try { return j ? JSON.parse(j) : null; } catch { return null; } }

// Зчитати snapshot із поточного option вибраного об’єкта О2 (якщо аплайєр прикріпив)
function __readSnapshotFromO2Select() {
  const sel = document.getElementById('distObject2');
  if (!sel || sel.tagName !== 'SELECT') return null;
  const opt = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
  if (!opt || !opt.dataset || !opt.dataset.snapshot) return null;
  const s = __safeParse(opt.dataset.snapshot);
  // Мінімальна валідність значення
  const v = Number(s?.value);
  if (!Number.isFinite(v) || v <= 0) return null;
  return s;
}

// Побудувати snapshot із наявних даних калькуляції (якщо dataset відсутній)
// Мінімальний самодостатній опис: id, category_key, value, unit, name_(*) за можливості.
function __buildSnapshotFromData(data) {
  const v = Number(data?.object2?.valueReal);
  const u = data?.object2?.unit || 'km';
  if (!Number.isFinite(v) || v <= 0) return null;

  const categoryKey =
    (data?.object2?.categoryKey ?? data?.object2?.category ?? null);
  const objectId =
    (data?.object2?.userId ?? data?.object2?.objectId ?? data?.object2?.id ?? null);

  const name = String(data?.object2?.name || '').trim();

  const s = {
    id: objectId ? String(objectId) : null,
    category_key: categoryKey ? String(categoryKey) : null,
    value: v,
    unit: u || null,
  };

  // Якщо є назва — покладемо її у загальні поля назв (можуть бути використані для підписів)
  if (name) {
    s.name_ua = name;
    s.name_en = name;
    s.name_es = name;
  }

  // Опис за наявності (не обов’язковий)
  const descr = String(data?.object2?.description || '').trim();
  if (descr) {
    s.description_ua = descr;
    s.description_en = descr;
    s.description_es = descr;
  }

  return s;
}

/* ───────────────────────── АПДЕЙТ БУФЕРА О2 ───────────────────────── */

function __pushSelectedO2(data) {
  try {
    // 1) Спробувати взяти snapshot із dataset <option> у #distObject2 (аплайєр його ставить)
    const snap = __readSnapshotFromO2Select() || __buildSnapshotFromData(data);

    // 2) Стабільні ключі для сцени
    //    Перевага — значенням із snapshot; фолбек — з data (але лише як тимчасова опора)
    const categoryKey = snap?.category_key
      ? String(snap.category_key)
      : String(data?.object2?.categoryKey ?? data?.object2?.category ?? '').trim() || null;

    const objectId = snap?.id
      ? String(snap.id)
      : String(
          data?.object2?.userId ??
          data?.object2?.objectId ??
          data?.object2?.id ??
          data?.object2?.name ?? // найгірший фолбек, уникаємо коли є snap
          ''
        ).trim() || null;

    const name = String(data?.object2?.name || '').trim() || null;

    if (!categoryKey || !objectId) return;

    __distanceSelectedO2s.push({
      categoryKey,
      objectId,
      name,
      // Зберігаємо snapshot як є (якщо він валідний)
      ...(snap ? { snapshot: snap } : {})
    });
  } catch (_) {}
}

function __resetSelectedO2s() {
  __distanceSelectedO2s.length = 0;
}

// Публічний геттер для серіалізатора
try {
  (window.orbit ||= {});
  window.orbit.getUniversDistanceSelectedO2s = () => __distanceSelectedO2s.slice();
} catch {}

/* ───────────────────────── ГЛОБАЛЬНІ ПОДІЇ ───────────────────────── */

// Скидання лічильника та вибраних О2 на глобальний UI-RESET
try {
  window.addEventListener('orbit:ui-reset', () => {
    distanceResultSeq = 0;
    __resetSelectedO2s();
  });
} catch {}

/* ───────────────────────── ОСНОВНИЙ ОБРОБНИК ───────────────────────── */

/**
 * onDistanceCalculate({ scope, object1Group, object2Group })
 * Викликається системою (panel_buttons.js) для режиму distance.
 */
export function onDistanceCalculate({ scope /*, object1Group, object2Group */ }) {
  // 1) Зібрати дані
  const data = getDistanceData(scope);

  // Підпис інфопанелі: «Всесвіт: Відстань»
  setModeLabelKeys({
    modeKey: 'panel_title_univers',
    subKey:  'panel_title_univers_distance'
  });

  // Кольори — стабільні для baseline, різні для кожного О2
  const color1 = getColorForKey('distance:baseline');
  const color2 = getColorForKey(`distance:o2:${++distanceResultSeq}`);

  // 2) Baseline у калькуляторі
  const baselineDiameter = Number(data?.object1?.diameterScaled) || 0; // м
  const realD1 = Number(data?.object1?.valueReal); // реальний діаметр О1 (у баз. од., напр. км)
  const u1 = data?.object1?.unit || 'km';

  resetDistanceScale(); // чистий стан на кожен розрахунок
  setDistanceBaseline({
    valueReal: realD1,
    unit: u1,
    circleDiameterMeters: baselineDiameter,
    color: color1
  });

  // 2a) Намалювати базове коло (якщо діаметр > 0)
  const baselineRadius = baselineDiameter > 0 ? baselineDiameter / 2 : 0;
  const baselineId = 'distance_baseline';
  if (baselineRadius > 0) {
    const id = addGeodesicCircle(baselineRadius, color1, baselineId);
    if (id) {
      // підпис: назва О1
      const label = String(data?.object1?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 2b) Інфопанель (уніфіковане API)
  const o1RealOk = Number.isFinite(realD1) && realD1 > 0;

  addGroup({
    id: 'distance_o1',
    title: data?.object1?.name || '',
    color: color1,
    groupType: 'baseline',
    // baseline у «Відстані» — це діаметри
    uiLeftLabelKey:  'diameter.labels.o1.left',   // "Діаметр"
    uiRightLabelKey: 'diameter.labels.o1.right',  // "Масштабований діаметр"
  });
  appendVariant({
    id: 'distance_o1',
    variant: 'single',
    realValue: o1RealOk ? realD1 : null,
    realUnit:  o1RealOk ? u1 : null,
    // Для baseline показуємо ДІАМЕТР (м)
    scaledMeters: baselineDiameter
  });
  if (String(data?.object1?.description || '').trim()) {
    setGroupDescription({
      id: 'distance_o1',
      description: data.object1.description
    });
  }

  // ——— LOCK O1 UI ДО RESET + START SESSION ———
  const baselineValid = o1RealOk && baselineDiameter > 0;
  if (baselineValid && scope) {
    const o1group = scope.querySelector('.object1-group');
    if (o1group) {
      o1group.classList.add('is-locked');
      // Вимкнути всі контроли в секторі О1
      o1group.querySelectorAll('select, input, button, textarea')
        .forEach(el => { el.disabled = true; });
    }
    // Позначити початок активної сесії (для попередження при зміні мови)
    try { window.dispatchEvent(new CustomEvent('orbit:session-start')); } catch {}
    
    // — маркер центру кіл: один раз, тихо
    (async () => {
      try {
        const { markerLayer, defaultCenterLon, defaultCenterLat } = await import('/js/globe/globe.js');
        const { placeMarker } = await import('/js/globe/markers.js');

        const ents = markerLayer.getEntities?.() || [];
        if (!ents.length) {
          placeMarker(defaultCenterLon, defaultCenterLat, { silent: true, suppressEvent: true });
        }
      } catch (e) {
        console.warn('[calculate] center marker skipped:', e);
      }
    })();
  }

  // 3) О2: обчислити через калькулятор (distance_to_earth у баз. од., напр. км)
  const dist2 = Number(data?.object2?.valueReal);
  const u2 = data?.object2?.unit || 'km';
  const res = addDistanceCircle({
    valueReal: dist2,
    unit: u2,
    color: color2
  });

  // 3a) Намалювати коло О2 (якщо радіус валідний)
  if (res && Number(res.scaledRadiusMeters) > 0) {
    const id = addGeodesicCircle(res.scaledRadiusMeters, color2, `distance_r${distanceResultSeq}`);
    if (id) {
      const label = String(data?.object2?.name || '').trim();
      if (label) setCircleLabelTextById(id, label);
    }
  }

  // 4) Інфопанель: результат О2
  const o2RealOk = Number.isFinite(dist2) && dist2 > 0;
  const scaledDiameterMeters = res && Number(res.scaledRadiusMeters) > 0
    ? 2 * Number(res.scaledRadiusMeters)
    : 0;

  const groupId = `distance_o2_${distanceResultSeq}`;

  addGroup({
    id: groupId,
    title: data?.object2?.name || '',
    color: color2,
    groupType: 'item',
    uiLeftLabelKey:  'distance.labels.o2.left',   // "Відстань до Землі"
    uiRightLabelKey: 'distance.labels.o2.right',  // "Масштабована відстань (радіус)"
  });
  if (String(data?.object2?.description || '').trim()) {
    setGroupDescription({
      id: groupId,
      description: data.object2.description
    });
  }

  appendVariant({
    id: groupId,
    variant: 'single',
    realValue: o2RealOk ? dist2 : null,
    realUnit:  o2RealOk ? u2 : null,
    // ВАЖЛИВО: для О2 у «Відстані» scaledMeters = РАДІУС
    scaledMeters: (res && Number(res.scaledRadiusMeters) > 0) ? Number(res.scaledRadiusMeters) : 0,
    invisibleReason: res?.tooLarge ? 'tooLarge' : null,
    requiredBaselineMeters: res?.requiredBaselineMeters ?? null
  });

  // 5) Запам'ятати щойно доданий О2 (із snapshot, якщо доступний)
  __pushSelectedO2(data);

  // Консоль для діагностики
  console.log(
    '[mode:distance] D1=%sm; realD1=%s%s; dist2=%s%s → D2=%sm',
    baselineDiameter,
    o1RealOk ? realD1.toLocaleString() : '—', o1RealOk ? u1 : '',
    o2RealOk ? dist2.toLocaleString() : '—', o2RealOk ? u2 : '',
    scaledDiameterMeters
  );
}
