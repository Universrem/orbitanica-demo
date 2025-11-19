// /js/panels/publicScenes.panel.js
import { t, getCurrentLang } from '/js/i18n.js';
import { getSceneOfDay, listInteresting, listAllPublic } from '/cabinet/js/cloud/scenes.cloud.js';
import { incrementSceneView, toggleLike } from '/cabinet/js/cloud/scenes.cloud.js';
import { getMyLikedSceneIds } from '/cabinet/js/cloud/scenes.cloud.js';
import { resetAllUI } from '/js/events/reset.js';


const state = {
  allOffset: 0,
  allLimit: 3,
  allBusy: false,
  allDone: false,
  allMode: null, // фільтр за режимом у "Усі сцени"
};
let isUiResetInProgress = false;

function q(sel, root = document) { return root.querySelector(sel); }
function el(tag, cls, attrs = {}) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') e.textContent = v ?? '';
    else e.setAttribute(k, v ?? '');
  }
  return e;
}
function dateOnly(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString();
}
function ensureSectionContent(detailsEl) {
  let c = detailsEl.querySelector(':scope > .section-content');
  if (!c) {
    c = document.createElement('div');
    c.className = 'section-content';
    detailsEl.appendChild(c);
  }
  return c;
}

// --- i18n helpers ---
function tStrict(key) {
  const v = t(key);
  return v && v !== key ? v : '';
}

// === Мови сцен (UA / EN / ES) ===
const SCENE_LANGS = ['ua', 'en', 'es'];

const ALL_SCENES_MODES = [
  { value: '',                  familyKey: null,                 labelKey: 'panel_title_all_scenes' },

  { value: 'univers_distance',  familyKey: 'panel_title_univers', labelKey: 'panel_title_univers_distance' },
  { value: 'univers_diameter',  familyKey: 'panel_title_univers', labelKey: 'panel_title_univers_diameter' },
  { value: 'univers_mass',      familyKey: 'panel_title_univers', labelKey: 'panel_title_univers_mass' },
  { value: 'univers_luminosity',familyKey: 'panel_title_univers', labelKey: 'panel_title_univers_luminosity' },

  { value: 'geo_population',    familyKey: 'panel_title_geo',     labelKey: 'panel_title_geo_population' },
  { value: 'geo_area',          familyKey: 'panel_title_geo',     labelKey: 'panel_title_geo_area' },
  { value: 'geo_objects',       familyKey: 'panel_title_geo',     labelKey: 'panel_title_geo_objects' },

  { value: 'money',             familyKey: null,                 labelKey: 'panel_title_money' },
  { value: 'math',              familyKey: null,                 labelKey: 'panel_title_math' },
  { value: 'history',           familyKey: null,                 labelKey: 'panel_title_history' },
];

const MODE_SECTION_IDS = [
  'univers_distance',
  'univers_diameter',
  'univers_mass',
  'univers_luminosity',
  'geo_population',
  'geo_area',
  'geo_objects',
  'money',
  'math',
  'history',
];

const trim = (v) => (v == null ? '' : String(v).trim());

function validateSceneLang(l) {
  const v = trim(l).toLowerCase();
  return SCENE_LANGS.includes(v) ? v : 'ua';
}

function currSceneLang() {
  try {
    if (typeof getCurrentLang === 'function') {
      return validateSceneLang(getCurrentLang());
    }
  } catch (_) {}
  return 'ua';
}

// порядок мов: спочатку поточна, потім інші
function sceneLangsOrder(L) {
  const base = validateSceneLang(L || currSceneLang());
  return [base, ...SCENE_LANGS.filter((x) => x !== base)];
}

function pickSceneI18n(row, base, L = currSceneLang()) {
  const order = sceneLangsOrder(L);

  // прямий переклад для поточної мови
  const direct = trim(row && row[`${base}_${order[0]}`]);
  if (direct) return direct;

  // інші переклади (якщо нема поточної)
  for (let i = 1; i < order.length; i++) {
    const via = trim(row && row[`${base}_${order[i]}`]);
    if (via) return via;
  }

  // fallback на «старе» поле
  return trim(row && row[base]) || '';
}

function titleOf(row, L = currSceneLang()) {
  return pickSceneI18n(row, 'title', L) || tStrict('scenes.untitled') || '';
}

function descOf(row, L = currSceneLang()) {
  return pickSceneI18n(row, 'description', L);
}

// Контроль дублювань у списках
const seenAllIds = new Set();
const seenInterestingIds = new Set();

// Створює всередині .section-content два слоти: .cards (список) і .footer (кнопки)
function ensureListAreas(detailsEl) {
  const content = ensureSectionContent(detailsEl);
  let cards = content.querySelector(':scope > .cards');
  if (!cards) {
    cards = el('div', 'cards');
    content.append(cards);
  }
  let footer = content.querySelector(':scope > .footer');
  if (!footer) {
    footer = el('div', 'footer');
    content.append(footer);
  }
  return { content, cards, footer };
}

// Позначає кнопку сцени активною, прибираючи актив з інших
function setActiveSceneButton(btn) {
  const root = document.getElementById('left-panel');
  if (!root) return;
  root.querySelectorAll('.section-content .public-scene-item.is-active')
    .forEach(el => el.classList.remove('is-active'));
  btn.classList.add('is-active');
}

// Відкрити тільки потрібний режим у лівій панелі, інші режими закрити
// "Сцена дня", "Цікаві сцени" та "Усі сцени" не чіпаємо.
function ensureModeSectionOpen(scene) {
  const modeId = scene && scene.mode ? String(scene.mode).trim() : '';
  if (!modeId) return;

  const root = document.getElementById('left-panel');
  if (!root) return;

  MODE_SECTION_IDS.forEach((id) => {
    const det = root.querySelector(`#left-panel > details#${id}`);
    if (!det) return;
    det.open = (id === modeId);
  });
}

// Визначити сімейство режиму за scene.mode
function getModeFamilyIdForScene(scene) {
  const mode = (scene && scene.mode ? String(scene.mode) : '').trim();
  if (!mode) return null;

  if (mode === 'univers' || mode.startsWith('univers_')) return 'univers';
  if (mode === 'geo'     || mode.startsWith('geo_'))      return 'geo';
  if (mode === 'money')   return 'money';
  if (mode === 'math')    return 'math';
  if (mode === 'history') return 'history';

  return null;
}

// Відкрити потрібне сімейство + конкретний режим, інші закрити (без скролу, без кліку по summary)
function ensureModeFamilyOpen(scene) {
  const familyId = getModeFamilyIdForScene(scene);
  const modeId = scene && scene.mode ? String(scene.mode).trim() : '';

  const root = document.getElementById('left-panel');
  if (!root) return;

  const FAMILY_IDS = ['univers', 'geo', 'money', 'math', 'history'];

  // 1) Сімейства (Всесвіт / Географія / Гроші / Математика / Історія)
  if (familyId) {
    FAMILY_IDS.forEach((id) => {
      const det = root.querySelector(`#left-panel > details#${id}`);
      if (!det) return;
      det.open = (id === familyId);
    });
  }

  // 2) Конкретний режим усередині сімейства (univers_distance, geo_population тощо)
  if (!modeId) return;

  // шукаємо <details id="modeId">
  const modeDetails = root.querySelector(`details#${modeId}`);
  if (!modeDetails) return;

  // шукаємо батьківське сімейство (top-level details)
  const familyDet = modeDetails.closest('#left-panel > details');

  if (familyDet) {
    // закрити всі інші підрежими всередині цього сімейства
    familyDet.querySelectorAll('details').forEach((d) => {
      if (d === modeDetails) return;
      d.open = false;
    });
  }

  // відкрити потрібний режим
  modeDetails.open = true;
}

// Єдиний шлях застосувати публічну сцену: повний reset, відкрити потрібний режим, потім apply
function applyPublicScene(scene) {
  try {
    if (!scene?.query || !window.orbit?.applyScene) return;

    // Повний скидання (той самий, що по кнопці Reset)
    resetAllUI();

    // Відкрити тільки той режим, який відповідає scene.mode
    // (інші режими закриваються, "Усі сцени" залишається відкритою)
    ensureModeSectionOpen(scene);

    // Застосувати сцену начисто
    window.orbit.applyScene(scene.query);
  } catch (e) {
    console.error('[publicScenes] applyPublicScene failed:', e);
  }
}

function renderList(cardsContainer, rows, { append = false, seen = null } = {}) {
  if (!append) {
    cardsContainer.replaceChildren();
    if (seen) seen.clear();
  }
  rows.forEach(row => {
    if (seen && row.id && seen.has(row.id)) return;

    const btn   = el('button', 'public-scene-item', { type: 'button' });
    btn.dataset.sceneId = row.id;

    const titleText = titleOf(row);
    const descText  = descOf(row);

    const title = el('div', 'public-scene-title', { text: titleText });
    const desc  = el('div',  'public-scene-desc',  { text: descText });

    // ── Статистика: ♥ лайки + 👁 перегляди
    const stats = el('div', 'public-scene-stats');

    const likeBtn  = el('button', 'scene-like-btn', { type: 'button', 'aria-label': 'Like' });
    const heartOutline = el('span', 'heart-outline', { text: '♡' });  // контур
    const heartFill    = el('span', 'heart-fill',    { text: '♥' });  // заливка (ховається CSS)
    const likeNum      = el('span', 'scene-like-num', { text: String(row.likes ?? 0) });

    likeBtn.append(heartOutline, heartFill, likeNum);

    // початковий стан: показуємо ♡; якщо з бекенду прийшов флаг — відразу ♥
    const likedInit = row.likedByMe ?? row.liked ?? false;
    likeBtn.classList.toggle('is-liked', !!likedInit);
    likeBtn.setAttribute('aria-pressed', likedInit ? 'true' : 'false');

    const viewsSpan = el('span', 'scene-views', { text: `👁 ${row.views ?? 0}` });

    stats.append(likeBtn, viewsSpan);

    // У списках опис прихований до кліку по назві
    desc.hidden = true;

    // Клік по НАЗВІ: 1) показ/приховати опис, 2) інкремент через бек і взяти «правду», 3) застосувати сцену, 4) підсвітити картку
    title.addEventListener('click', async (ev) => {
      ev.stopPropagation();

      // Закрити інші описи в межах цього списку
      cardsContainer.querySelectorAll('.public-scene-desc').forEach(d => { d.hidden = true; });
      // Тогл опису поточної сцени
      desc.hidden = !desc.hidden;

      // Інкремент переглядів — беремо фактичні значення з БД
      try {
        if (row && row.id) {
          const res = await incrementSceneView(row.id);
          if (res && typeof res.views === 'number') {
            row.views = res.views;
            viewsSpan.textContent = `👁 ${res.views}`;
          }
          if (res && typeof res.likes === 'number') {
            row.likes = res.likes;
            likeNum.textContent = String(res.likes);
          }
        }
      } catch (e) {
        console.error('[views]', e);
      }

      // Застосувати сцену та підсвітити картку
      applyPublicScene(row);
      setActiveSceneButton(btn);
    });

    // Клік по всій картці більше НЕ запускає відтворення
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
    });

    // Клік по сердечку: toggle лайк (беремо «правду» з бекенду)
    likeBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      try {
        const res = await toggleLike(row.id);
        const likedNow = !!res.liked;
        const likesNow = Number(res.likes ?? 0);

        // оновлюємо лічильники з відповіді
        likeNum.textContent = String(likesNow);
        row.likes = likesNow;

        if (typeof res.views === 'number') {
          row.views = res.views;
          viewsSpan.textContent = `👁 ${res.views}`;
        }

        // оновлюємо стан сердечка
        likeBtn.classList.toggle('is-liked', likedNow);
        likeBtn.setAttribute('aria-pressed', likedNow ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('sceneLikeToggled', { detail: { id: row.id, liked: likedNow } }));
      } catch (e) {
        console.error('[like]', e);
      }
    });

    btn.append(title, desc, stats);
    cardsContainer.append(btn);
    if (seen && row.id) seen.add(row.id);
  });
}


/* ---------- handlers ---------- */

async function handleSceneDayOpen(detailsEl) {
  const content = ensureSectionContent(detailsEl);
  content.replaceChildren();

  try {
    const scene = await getSceneOfDay();
    if (!scene) {
      content.textContent = (t('scenes.empty') || '');
      return;
    }

    const titleText = titleOf(scene);
    const descText  = descOf(scene);

    // Використовуємо ті самі класи, що й у списках (щоб стилі лишилися незмінні)
    const btn   = el('button', 'public-scene-item', { type: 'button' });
    btn.dataset.sceneId = scene.id;
    const title = el('div', 'public-scene-title', { text: titleText });
    const desc  = el('div',  'public-scene-desc',  { text: descText });

    // Статистика: ♥ лайки + 👁 перегляди
    const stats = el('div', 'public-scene-stats');
    const likeBtn  = el('button', 'scene-like-btn', { type: 'button', 'aria-label': 'Like' });
    const heartOutline = el('span', 'heart-outline', { text: '♡' });
    const heartFill    = el('span', 'heart-fill',    { text: '♥' });
    const likeNum      = el('span', 'scene-like-num', { text: String(scene.likes ?? 0) });
    likeBtn.append(heartOutline, heartFill, likeNum);

    let likedInit = false;
    try {
      const set = await getMyLikedSceneIds([scene.id]);
      likedInit = set.has(scene.id);
    } catch (e) {
      console.warn('[likes init: day]', e);
    }

    likeBtn.classList.toggle('is-liked', !!likedInit);
    likeBtn.setAttribute('aria-pressed', likedInit ? 'true' : 'false');

    const viewsSpan = el('span', 'scene-views', { text: `👁 ${scene.views ?? 0}` });
    stats.append(likeBtn, viewsSpan);

    // Лайк не запускає відтворення
    likeBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      try {
        const res = await toggleLike(scene.id);
        const likedNow = !!res.liked;
        const likesNow = Number(res.likes ?? 0);
        likeNum.textContent = String(likesNow);
        scene.likes = likesNow;
        likeBtn.classList.toggle('is-liked', likedNow);
        likeBtn.setAttribute('aria-pressed', likedNow ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('sceneLikeToggled', { detail: { id: scene.id, liked: likedNow } }));

      } catch (e) {
        console.error('[like: day]', e);
      }
    });

    // У "Сцені дня" опис показуємо одразу
    desc.hidden = false;

    btn.append(title, desc, stats);
    content.append(btn);

    // Автовідтворення при відкритті секції: інкремент і беремо «правду» з БД
    try {
      if (scene?.id) {
        const res = await incrementSceneView(scene.id);
        if (res && typeof res.views === 'number') {
          scene.views = res.views;
          viewsSpan.textContent = `👁 ${res.views}`;
        } else {
          viewsSpan.textContent = `👁 ${scene.views ?? 0}`;
        }
        if (res && typeof res.likes === 'number') {
          scene.likes = res.likes;
          likeNum.textContent = String(res.likes);
        }
      }
    } catch (e) {
      viewsSpan.textContent = `👁 ${scene.views ?? 0}`;
      console.error('[views: day]', e);
    }

    applyPublicScene(scene);
    setActiveSceneButton(btn);

  } catch (e) {
    console.error('[scene_day]', e);
    content.textContent = (t('scenes.empty') || '');
  }
}


async function handleInterestingOpen(detailsEl) {
  // не повторюємо завантаження при кожному відкритті
  if (detailsEl.dataset.loading === 'true' || detailsEl.dataset.loaded === 'true') return;
  detailsEl.dataset.loading = 'true';

  const { content, cards, footer } = ensureListAreas(detailsEl);
  footer.replaceChildren(); // для interesting пагінації немає
  cards.textContent = (t('loading') || 'Loading…');

  try {
    const rows = await listInteresting({ limit: 50 });
    // мої лайки між сесіями
    try {
      const ids = rows.map(r => r.id).filter(Boolean);
      const likedSet = await getMyLikedSceneIds(ids);
      rows.forEach(r => { r.liked = likedSet.has(r.id); });
    } catch (e) {
      console.warn('[likes init: interesting]', e);
    }

    cards.replaceChildren();
    if (!rows?.length) {
      cards.textContent = (t('scenes.empty') || '');
    } else {
      renderList(cards, rows, { append: false, seen: seenInterestingIds });
    }
    detailsEl.dataset.loaded = 'true';
  } catch (e) {
    console.error('[interesting]', e);
    cards.textContent = (t('scenes.empty') || '');
    detailsEl.dataset.loaded = '';
  } finally {
    detailsEl.dataset.loading = '';
  }
}
// Фільтр режимів для секції "Усі сцени"
function ensureAllScenesFilter(detailsEl, content, cards) {
  let bar = content.querySelector(':scope > .all-scenes-filter');
  let select;

  if (!bar) {
    bar = el('div', 'all-scenes-filter');
    select = el('select', 'all-scenes-filter-select');
    select.name = 'allScenesMode';
    bar.append(select);
    content.insertBefore(bar, cards);

    // реакція на зміну фільтра
        // реакція на зміну фільтра
    select.addEventListener('change', () => {
      state.allMode = select.value || null;

      // якщо це зміна через глобальний reset (orbit:ui-reset) — список не чіпаємо
      if (isUiResetInProgress) {
        return;
      }

      state.allOffset = 0;
      state.allDone = false;
      state.allBusy = false;
      seenAllIds.clear();

      const { cards, footer } = ensureListAreas(detailsEl);
      cards.replaceChildren();
      footer.replaceChildren();

      // заново тягнемо першу сторінку з новим фільтром
      handleAllOpen(detailsEl);
    });

  } else {
    select = bar.querySelector('select.all-scenes-filter-select');
  }

  if (!select) return;

  const prev = state.allMode || '';

  // перебудувати опції (і тексти, і вибраний пункт) — корисно і для зміни мови
    select.replaceChildren();
  ALL_SCENES_MODES.forEach((m) => {
    const modeLabel = tStrict(m.labelKey) || '';
    if (!modeLabel) return;

    let text = modeLabel;

    if (m.familyKey) {
      const familyLabel = tStrict(m.familyKey) || '';
      if (familyLabel) {
        text = `${familyLabel}: ${modeLabel}`;
      }
    }

    const opt = el('option', null, { value: m.value, text });
    select.append(opt);
  });
  select.value = prev;

}

async function handleAllOpen(detailsEl) {
  if (state.allBusy || state.allDone) return;

  const { content, cards, footer } = ensureListAreas(detailsEl);

  // Поставити/оновити фільтр над списком
  ensureAllScenesFilter(detailsEl, content, cards);

  const first = state.allOffset === 0;

  if (first) {
    cards.textContent = (t('loading') || 'Loading…');
    footer.replaceChildren();
    seenAllIds.clear();
  }

  state.allBusy = true;
  try {
    const rows = await listAllPublic({
      limit: state.allLimit,
      offset: state.allOffset,
      mode: state.allMode || undefined,
    });

    // мої лайки між сесіями
    try {
      const ids = rows.map(r => r.id).filter(Boolean);
      const likedSet = await getMyLikedSceneIds(ids);
      rows.forEach(r => { r.liked = likedSet.has(r.id); });
    } catch (e) {
      console.warn('[likes init: all]', e);
    }

    if (first) cards.replaceChildren();

    if (!rows?.length) {
      if (first) cards.textContent = (t('scenes.empty') || '');
      state.allDone = true;
      return;
    }

    renderList(cards, rows, { append: !first, seen: seenAllIds });
    state.allOffset += rows.length;

    // Кнопка "More" — лише у footer, окремо від карток
    let more = footer.querySelector(':scope > button.public-all-more');
    if (!more) {
      more = el('button', 'public-all-more cab-btn', {
        type: 'button',
        text: (t('btn_load_more') || 'Load more'),
      });
      more.addEventListener('click', () => handleAllOpen(detailsEl));
      footer.append(more);
    }

    if (rows.length < state.allLimit) {
      more.disabled = true;
      state.allDone = true;
    } else {
      more.disabled = false;
    }
  } catch (e) {
    console.error('[all_scenes]', e);
    if (first) cards.textContent = (t('scenes.empty') || '');
  } finally {
    state.allBusy = false;
  }
}

// Згорнути всі описи і зняти .is-active всередині конкретної секції
function resetSectionUI(detailsEl) {
  if (!detailsEl) return;
  detailsEl.querySelectorAll('.public-scene-item.is-active')
    .forEach(el => el.classList.remove('is-active'));
  detailsEl.querySelectorAll('.public-scene-desc')
    .forEach(d => { d.hidden = true; });
}

/* ---------- init ---------- */
export function initPublicScenesPanel() {
  const root = document.getElementById('left-panel');
  if (!root) return;

  // scene_day — при відкритті рендеримо назву/опис/статистику і авто-відтворюємо
  const dayDet = q('#left-panel > details#scene_day');
  if (dayDet && dayDet.dataset.inited !== 'true') {
    dayDet.dataset.inited = 'true';
    dayDet.addEventListener('toggle', () => {
      if (dayDet.open) {
        handleSceneDayOpen(dayDet);
      } else {
        // Закрили секцію: прибрати активні/згорнути описи та почистити контент
        resetSectionUI(dayDet);
        const content = ensureSectionContent(dayDet);
        content.replaceChildren();
      }
    });
  }

  // interesting — вантажимо один раз при першому відкритті
  const interDet = q('#left-panel > details#interesting');
  if (interDet && interDet.dataset.inited !== 'true') {
    interDet.dataset.inited = 'true';
    interDet.addEventListener('toggle', () => {
      if (interDet.open) {
        if (interDet.dataset.loaded === 'true') return;
        handleInterestingOpen(interDet);
      } else {
        // Закрито: синхронізуємо UI зі станом глобуса
        resetSectionUI(interDet);
      }
    });

  }

  // all_scenes — пагінація; перше відкриття робить перший феч
  const allDet = q('#left-panel > details#all_scenes');
  if (allDet && allDet.dataset.inited !== 'true') {
    allDet.dataset.inited = 'true';
    allDet.addEventListener('toggle', () => {
      if (allDet.open) {
        if (allDet.dataset.loaded !== 'true') {
          state.allOffset = 0; state.allDone = false; state.allBusy = false;
          handleAllOpen(allDet);
          allDet.dataset.loaded = 'true';
        }
      } else {
        // Закрито: прибрати активні/згорнути описи
        resetSectionUI(allDet);
      }
    });

  }
  // Сцени: при Reset — прибрати .is-active і згорнути всі описи
  root.addEventListener('click', (e) => {
    const resetBtn = e.target.closest('button[data-action="reset"]');
    if (!resetBtn) return;

    // Прибрати підсвітку активних
    root.querySelectorAll('.section-content .public-scene-item.is-active')
      .forEach(el => el.classList.remove('is-active'));

    // Згорнути всі описи у списках
    root.querySelectorAll('.section-content .public-scene-desc')
      .forEach(d => { d.hidden = true; });
  });
  // Синхронізація лічильників між розділами (після перегляду/лайку)
  window.addEventListener('sceneCountersUpdated', (e) => {
    const { id, views, likes } = e.detail || {};
    if (!id) return;

    document.querySelectorAll(`.public-scene-item[data-scene-id="${id}"]`).forEach(card => {
      const v = card.querySelector('.scene-views');
      const l = card.querySelector('.scene-like-num');
      if (v && typeof views === 'number') v.textContent = `👁 ${views}`;
      if (l && typeof likes === 'number') l.textContent = String(likes);
    });
  });
  // Синхронізація стану «сердечка» між розділами
  window.addEventListener('sceneLikeToggled', (e) => {
    const { id, liked } = e.detail || {};
    if (!id) return;

    document.querySelectorAll(`.public-scene-item[data-scene-id="${id}"]`).forEach(card => {
      const btn = card.querySelector('.scene-like-btn');
      if (!btn) return;
      btn.classList.toggle('is-liked', !!liked);
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    });
  });
  
  // Живий переклад: при зміні мови перерендеримо відкриті секції
  window.addEventListener('orbit:lang-change', () => {
    // Сцена дня
    const dayDet = q('#left-panel > details#scene_day');
    if (dayDet) {
      if (dayDet.open) {
        handleSceneDayOpen(dayDet);
      } else {
        const content = ensureSectionContent(dayDet);
        content.replaceChildren();
      }
    }

    // Цікаві сцени
    const interDet = q('#left-panel > details#interesting');
    if (interDet) {
      interDet.dataset.loaded = '';
      interDet.dataset.loading = '';
      if (interDet.open) {
        handleInterestingOpen(interDet);
      }
    }

    // Усі сцени
    const allDet = q('#left-panel > details#all_scenes');
    if (allDet) {
      state.allOffset = 0;
      state.allDone = false;
      state.allBusy = false;
      allDet.dataset.loaded = '';
      allDet.dataset.loading = '';
      if (allDet.open) {
        handleAllOpen(allDet);
        allDet.dataset.loaded = 'true';
      }
    }
  });

  // Глобальний reset: не перезавантажуємо список "Усі сцени" штучними change
  window.addEventListener('orbit:ui-reset', () => {
    isUiResetInProgress = true;
    // скинемо прапорець після того, як resetFormControls відправить свої change/input
    setTimeout(() => {
      isUiResetInProgress = false;
    }, 0);
  });
}

