// /js/globe/circle_focus.controller.js
// Контролер фокусу на колах: будує кнопки й керує польотом камери над/антипод центру кола.
// Без костилів: жодних глобалей, лише чисті залежності через init().
// Авторський намір: Варіант А (над центром сцени; якщо радіус > 90° — над антиподом).

/**
 * @typedef {Object} CircleItem
 * @property {string} id
 * @property {string} name
 * @property {string} color        // CSS-колір кола
 * @property {number} lon          // у градусах, -180..180
 * @property {number} lat          // у градусах, -90..90
 * @property {number} radiusM      // геодезичний радіус кола у метрах
 */

/**
 * @typedef {Object} CameraAPI
 * @property {(opts: { lon:number, lat:number, altitudeM:number, durationMs?:number }) => void} flyToNadir
 * @property {() => number | undefined} [getFovDeg]
 * @property {() => boolean} [isBusy]
 * @property {() => void} [stopInertia] // Новий метод
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const R_EARTH_M = 6371008.8;

/** Нормалізує довготу до [-180, 180]. */
function normLon(lonDeg) {
  let x = ((lonDeg + 180) % 360 + 360) % 360 - 180;
  // уникаємо -180 для стабільності відображення
  return x === -180 ? 180 : x;
}

/** Антипод для (lon, lat) у градусах. */
function antipode(lonDeg, latDeg) {
  return { lon: normLon(lonDeg + 180), lat: -latDeg };
}

/** Кутовий радіус кола у градусах. */
function circleAngularRadiusDeg(radiusM, planetRadiusM = R_EARTH_M) {
  // δ (рад) = r / R, для малих кіл добре; для великих достатньо точно
  return (radiusM / planetRadiusM) * RAD;
}

/**
 * Оцінка висоти камери, щоб коло «влізло» в кадр у надірному вигляді.
 * Параметризовано FOV (по вертикалі). Евристика узгоджується з кругами середніх кутів.
 */
function estimateAltitudeM(radiusM, fovDeg = 45, planetRadiusM = R_EARTH_M) {
  // Перетворимо реальний радіус кола на кут (рад), але якщо > 90°, показуємо «меншу» сторони (π - δ)
  const deltaRad = radiusM / planetRadiusM; // у радіанах
  const deltaEff = Math.min(deltaRad, Math.PI - deltaRad); // не більше "півсфери"
  const fovRad = (Math.max(15, Math.min(90, fovDeg)) * DEG);

  // Для надірного виду приблизно: видимий радіус ~ R * deltaEff.
  // Висота h задається так, щоб коло займало більшу частину висоти вікна:
  // viewport_radius ≈ (h) * tan(FOV/2). Потрібно: viewport_radius ≳ k * (R * deltaEff)
  // Звідси h ≈ k * R * deltaEff / tan(FOV/2)
  // k — емпіричний коефіцієнт (0.9..1.4 залежно від бажаного заповнення).
  const k = 1.15;
  const h = (k * planetRadiusM * deltaEff) / Math.tan(fovRad / 2);

  // Клемпи — уникаємо занадто малого/великого масштабу
  const MIN = 10;      // 60 км
  const MAX = 30_000_000;  // 30 тис. км
  return Math.min(Math.max(h, MIN), MAX);
}

/**
 * Обчислити ціль польоту: центр або антипод, плюс рекомендована висота.
 * @param {CircleItem} c
 * @param {number} fovDeg
 * @param {number} planetRadiusM
 */
function computeTarget(c, fovDeg, planetRadiusM) {
  const angDeg = circleAngularRadiusDeg(c.radiusM, planetRadiusM);
  const overEquator = angDeg > 90;
  const { lon, lat } = overEquator ? antipode(c.lon, c.lat) : { lon: c.lon, lat: c.lat };
  const altitudeM = estimateAltitudeM(c.radiusM, fovDeg, planetRadiusM);
  return { lon, lat, altitudeM };
}

/** Рендер однієї кнопки. */
function renderButton(circle, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'circle-btn';
  btn.dataset.id = circle.id;
  btn.title = circle.name;
  btn.setAttribute('aria-label', circle.name);

  // Вміст: кольорова крапка + текст
  const dot = document.createElement('span');
  dot.className = 'circle-btn__dot';
  dot.style.backgroundColor = circle.color;

  const label = document.createElement('span');
  label.className = 'circle-btn__label';
  label.textContent = circle.name;

  btn.append(dot, label);
  btn.addEventListener('click', () => onClick(circle));
  return btn;
}

/** Очистка контейнера. */
function clearContainer(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Ініціалізація контролера.
 * @param {Object} opts
 * @param {HTMLElement} opts.container                 - контейнер для кнопок (наприклад, #circle-toolbar)
 * @param {CameraAPI}   opts.cameraAPI                 - адаптер камери
 * @param {number}      [opts.planetRadiusM=6371008.8]
 * @param {number}      [opts.defaultFovDeg=45]        - якщо cameraAPI.getFovDeg() недоступний
 * @param {number}      [opts.flyDurationMs=1200]
 */
export function initCircleFocusController({
  container,
  cameraAPI,
  planetRadiusM = R_EARTH_M,
  defaultFovDeg = 45,
  flyDurationMs = 1200
}) {
  if (!(container instanceof HTMLElement)) {
    throw new Error('[circle_focus.controller] container is required HTMLElement');
  }
  if (!cameraAPI || typeof cameraAPI.flyToNadir !== 'function') {
    throw new Error('[circle_focus.controller] cameraAPI.flyToNadir(opts) is required');
  }

  /** @type {CircleItem[]} */
  let circles = [];

  const getFovDeg = () => {
    try {
      const v = cameraAPI.getFovDeg?.();
      return (typeof v === 'number' && v > 0) ? v : defaultFovDeg;
    } catch {
      return defaultFovDeg;
    }
  };

  const handleClick = (circle) => {
    // Якщо камера вже летить — ігноруємо клік (щоб не плодити конкуренцію анімацій)
    if (typeof cameraAPI?.isBusy === 'function' && cameraAPI.isBusy()) return;

    // Зупиняємо інерцію камери перед польотом (локально тільки для цього кліку)
    if (typeof cameraAPI.stopInertia === 'function') {
      cameraAPI.stopInertia();
    }

    // Визначаємо ціль (центр або антипод), але висоту НЕ рахуємо тут
    const fov = getFovDeg();
    const { lon, lat /* , altitudeM */ } = computeTarget(circle, fov, planetRadiusM);

    // Делегуємо все камері: лише координати + радіус.
    // НЕ передаємо durationMs і НЕ передаємо altitudeM — камера вирішує сама (крок 1).
    cameraAPI.flyToNadir({ lon, lat, radiusM: circle.radiusM });
  };

  const render = () => {
    clearContainer(container);
    // Сортувати можна за величиною кола або за порядком створення — залишимо як є:
    for (const c of circles) {
      container.appendChild(renderButton(c, handleClick));
    }
  };

  // Публічний метод оновлення (можете викликати напряму)
  function update(newCircles) {
    if (!Array.isArray(newCircles)) return;
    // Валідація мінімальна: фільтруємо лише валідні
    circles = newCircles.filter(c =>
      c && typeof c.id === 'string' && typeof c.name === 'string' &&
      typeof c.color === 'string' &&
      Number.isFinite(c.lon) && Number.isFinite(c.lat) &&
      Number.isFinite(c.radiusM) && c.radiusM > 0
    );
    render();
  }

  // Слухаємо подію з реєстру кіл
  const onCirclesUpdated = (e) => {
    update(e?.detail?.circles ?? []);
  };
  document.addEventListener('circles:updated', onCirclesUpdated);

  // Повертаємо невеличкий API на випадок ручного керування/очистки
  return {
    update,
    destroy() {
      document.removeEventListener('circles:updated', onCirclesUpdated);
      clearContainer(container);
    }
  };
}