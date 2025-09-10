// /js/panels/publicScenes.panel.js
import { t } from '/js/i18n.js';
import { getSceneOfDay, listInteresting, listAllPublic } from '/cabinet/js/cloud/scenes.cloud.js';

const state = {
  allOffset: 0,
  allLimit: 30,
  allBusy: false,
  allDone: false,
  interLoaded: false,
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

function renderList(container, rows, { append = false } = {}) {
  if (!append) container.replaceChildren();
  rows.forEach(row => {
    const btn = el('button', '', { type: 'button' });
    const title = el('div', '', { text: (row.title?.trim() || t('scenes.untitled') || '') });
    const desc  = el('div', '', { text: (row.description?.trim() || '') });
    const meta  = el('div', '', { text: dateOnly(row.created_at) });
    btn.append(title, desc, meta);
    btn.addEventListener('click', () => {
      if (window.orbit?.applyScene && row?.query) window.orbit.applyScene(row.query);
    });
    container.append(btn);
  });
}

async function handleSceneDayClick(summaryEl) {
  try {
    const scene = await getSceneOfDay();
    if (scene && window.orbit?.applyScene && scene.query) {
      window.orbit.applyScene(scene.query);
    }
    // не блокуємо відкриття details: списку все одно немає
  } catch (e) {
    console.error('[scene_day]', e);
  }
}

async function handleInterestingOpen(detailsEl) {
  const content = q(':scope > .section-content', detailsEl);
  if (!content) return;
  content.textContent = t('loading') || 'Loading…';
  try {
    const rows = await listInteresting({ limit: 50 });
    if (!rows?.length) content.textContent = t('scenes.empty') || '';
    else renderList(content, rows);
  } catch (e) {
    console.error('[interesting]', e);
    content.textContent = t('scenes.empty') || '';
  }
}

async function handleAllOpen(detailsEl) {
  const content = q(':scope > .section-content', detailsEl);
  if (!content) return;

  const first = state.allOffset === 0;
  if (first) content.textContent = t('loading') || 'Loading…';

  if (state.allBusy || state.allDone) return;
  state.allBusy = true;
  try {
    const rows = await listAllPublic({ limit: state.allLimit, offset: state.allOffset });
    if (first) content.replaceChildren(); // чистимо тільки на першій сторінці

    if (!rows?.length) {
      if (first) content.textContent = t('scenes.empty') || '';
      state.allDone = true;
      return;
    }

    renderList(content, rows, { append: !first });
    state.allOffset += rows.length;

    let more = q(':scope > .public-all-more', content);
    if (!more) {
      more = el('button', 'public-all-more', { type: 'button', text: t('btn_load_more') || 'Load more' });
      more.addEventListener('click', () => handleAllOpen(detailsEl));
      content.append(more);
    }
    more.disabled = rows.length < state.allLimit;
    if (more.disabled) state.allDone = true;
  } catch (e) {
    console.error('[all_scenes]', e);
    if (first) content.textContent = t('scenes.empty') || '';
  } finally {
    state.allBusy = false;
  }
}

export function initPublicScenesPanel() {
  const root = document.getElementById('left-panel');
  if (!root) return;

  const q = (sel, r = document) => r.querySelector(sel);

  // scene_day: клік по summary — одразу застосувати сцену
  const dayDet = q('#left-panel > details#scene_day');
  if (dayDet) {
    const sum = q(':scope > summary', dayDet);
    if (sum) sum.addEventListener('click', () => handleSceneDayClick(sum));
  }

  // interesting: при відкритті завантажити список
  const interDet = q('#left-panel > details#interesting');
  if (interDet) {
    interDet.addEventListener('toggle', () => {
      if (interDet.open) handleInterestingOpen(interDet);
    });
  }

  // all_scenes: пагінація “Завантажити ще”
  const allDet = q('#left-panel > details#all_scenes');
  if (allDet) {
    state.allOffset = 0; state.allDone = false; state.allBusy = false;
    allDet.addEventListener('toggle', () => {
      if (allDet.open) handleAllOpen(allDet);
    });
  }
}
