// /js/panels/publicScenes.panel.js
import { t } from '/js/i18n.js';
import { getSceneOfDay, listInteresting, listAllPublic } from '/cabinet/js/cloud/scenes.cloud.js';
import { incrementSceneView, toggleLike } from '/cabinet/js/cloud/scenes.cloud.js';
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
    const likeIcon = el('span', 'scene-like-icon', { text: '♥' });
    const likeNum  = el('span', 'scene-like-num',  { text: String(row.likes ?? 0) });
    likeBtn.append(likeIcon, likeNum);

    const viewsSpan = el('span', 'scene-views', { text: `👁 ${row.views ?? 0}` });

    stats.append(likeBtn, viewsSpan);

    // Клік по картці: спершу +1 перегляд, потім чисте застосування сцени
    btn.addEventListener('click', async () => {
      try {
        if (row?.id) {
          const cur = Number(row.views ?? 0) || 0;
          viewsSpan.textContent = `👁 ${cur + 1}`;
          row.views = cur + 1;
          await incrementSceneView(row.id);
        }
      } catch (e) {
        // якщо не вдалось — повертаємо попереднє число
        viewsSpan.textContent = `👁 ${row.views ?? 0}`;
        console.error('[views]', e);
      }
      applyPublicScene(row);
    });

    // Клік по сердечку: toggle лайк (не запускає застосування сцени)
    likeBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      try {
        const res = await toggleLike(row.id);
        likeNum.textContent = String(res.likes ?? 0);
        row.likes = res.likes ?? 0;
        likeBtn.classList.toggle('is-liked', !!res.liked);
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

async function handleSceneDayClick(summaryEl) {
  try {
    const scene = await getSceneOfDay();
    if (scene) applyPublicScene(scene);
  } catch (e) {
    console.error('[scene_day]', e);
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

/* ---------- init ---------- */
export function initPublicScenesPanel() {
  const root = document.getElementById('left-panel');
  if (!root) return;

  // scene_day — клік по summary застосовує сцену (ініціалізуємо один раз)
  const dayDet = q('#left-panel > details#scene_day');
  if (dayDet && dayDet.dataset.inited !== 'true') {
    dayDet.dataset.inited = 'true';
    const sum = q(':scope > summary', dayDet);
    if (sum) sum.addEventListener('click', () => handleSceneDayClick(sum));
  }

  // interesting — вантажимо один раз при першому відкритті
  const interDet = q('#left-panel > details#interesting');
  if (interDet && interDet.dataset.inited !== 'true') {
    interDet.dataset.inited = 'true';
    interDet.addEventListener('toggle', () => {
      if (!interDet.open) return;
      if (interDet.dataset.loaded === 'true') return;
      handleInterestingOpen(interDet);
    });
  }

  // all_scenes — пагінація; перше відкриття робить перший феч
  const allDet = q('#left-panel > details#all_scenes');
  if (allDet && allDet.dataset.inited !== 'true') {
    allDet.dataset.inited = 'true';
    allDet.addEventListener('toggle', () => {
      if (!allDet.open) return;
      if (allDet.dataset.loaded !== 'true') {
        state.allOffset = 0; state.allDone = false; state.allBusy = false;
        handleAllOpen(allDet);
        allDet.dataset.loaded = 'true';
      }
    });
  }
}

