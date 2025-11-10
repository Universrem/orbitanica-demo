// /js/panels/publicScenes.panel.js
import { t } from '/js/i18n.js';
import { getSceneOfDay, listInteresting, listAllPublic } from '/cabinet/js/cloud/scenes.cloud.js';
import { incrementSceneView, toggleLike } from '/cabinet/js/cloud/scenes.cloud.js';
import { getMyLikedSceneIds } from '/cabinet/js/cloud/scenes.cloud.js';
import { resetAllUI } from '/js/events/reset.js';


const state = {
  allOffset: 0,
  allLimit: 30,
  allBusy: false,
  allDone: false,
};

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

// Єдиний шлях застосувати публічну сцену: спочатку м'який reset, потім apply
function applyPublicScene(scene) {
  try {
    if (!scene?.query || !window.orbit?.applyScene) return;

    // Повний скидання (той самий, що по кнопці Reset)
    resetAllUI();

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
    const title = el('div', 'public-scene-title', { text: (row.title?.trim() || t('scenes.untitled') || '') });
    const desc  = el('div',  'public-scene-desc',  { text: (row.description?.trim() || '') });

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

// Клік по НАЗВІ: 1) показ/приховати опис, 2) views++, 3) застосувати сцену, 4) підсвітити картку
title.addEventListener('click', async (ev) => {
  ev.stopPropagation();

  // Закрити інші відкриті описи в межах цього контейнера списку
  cardsContainer.querySelectorAll('.public-scene-desc').forEach(d => { d.hidden = true; });
  // Тогл опису поточної сцени
  desc.hidden = !desc.hidden;

  // Інкремент переглядів і застосування сцени
  try {
    if (row?.id) {
      const cur = Number(row.views ?? 0) || 0;
      // Оновити локально лічильник переглядів
      viewsSpan.textContent = `👁 ${cur + 1}`;
      row.views = cur + 1;
      await incrementSceneView(row.id);
    }
  } catch (e) {
    viewsSpan.textContent = `👁 ${row.views ?? 0}`;
    console.error('[views]', e);
  }

  // Чисте застосування сцени
  applyPublicScene(row);
  // Підсвітити активну картку
  setActiveSceneButton(btn);
});

// Клік по всій картці більше НЕ запускає відтворення
btn.addEventListener('click', (ev) => {
  ev.preventDefault();
});



    // Клік по сердечку: toggle лайк (не запускає застосування сцени)
likeBtn.addEventListener('click', async (ev) => {
  ev.stopPropagation();
  try {
    const res = await toggleLike(row.id);
    // лічильник з бекенду — джерело правди
    const likedNow = !!res.liked;
    const likesNow = Number(res.likes ?? 0);

    likeNum.textContent = String(likesNow);
    row.likes = likesNow;

    // візуальний стан: заповнення серця + ARIA
    likeBtn.classList.toggle('is-liked', likedNow);
    likeBtn.setAttribute('aria-pressed', likedNow ? 'true' : 'false');
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

    // Використовуємо ті самі класи, що й у списках (щоб стилі лишилися незмінні)
    const btn   = el('button', 'public-scene-item', { type: 'button' });
    const title = el('div', 'public-scene-title', { text: (scene.title?.trim() || t('scenes.untitled') || '') });
    const desc  = el('div',  'public-scene-desc',  { text: (scene.description?.trim() || '') });

    // Статистика: ♥ лайки + 👁 перегляди
    const stats = el('div', 'public-scene-stats');
    const likeBtn  = el('button', 'scene-like-btn', { type: 'button', 'aria-label': 'Like' });
    const heartOutline = el('span', 'heart-outline', { text: '♡' });
    const heartFill    = el('span', 'heart-fill',    { text: '♥' });
    const likeNum      = el('span', 'scene-like-num', { text: String(scene.likes ?? 0) });
    likeBtn.append(heartOutline, heartFill, likeNum);

    const likedInit = scene.likedByMe ?? scene.liked ?? false;
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
      } catch (e) {
        console.error('[like: day]', e);
      }
    });

    // У "Сцені дня" опис показуємо одразу (повний текст — як у вас, через фокус/hover)
    desc.hidden = false;

    btn.append(title, desc, stats);
    content.append(btn);

    // Автовідтворення при відкритті секції: +1 перегляд
    try {
      if (scene?.id) {
        const cur = Number(scene.views ?? 0) || 0;
        viewsSpan.textContent = `👁 ${cur + 1}`;
        scene.views = cur + 1;
        await incrementSceneView(scene.id);
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


async function handleAllOpen(detailsEl) {
  if (state.allBusy || state.allDone) return;

  const { content, cards, footer } = ensureListAreas(detailsEl);
  const first = state.allOffset === 0;

  if (first) {
    cards.textContent = (t('loading') || 'Loading…');
    footer.replaceChildren();
    seenAllIds.clear();
  }

  state.allBusy = true;
  try {
    const rows = await listAllPublic({ limit: state.allLimit, offset: state.allOffset });
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
      more = el('button', 'public-all-more cab-btn', { type: 'button', text: (t('btn_load_more') || 'Load more') });
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


}

