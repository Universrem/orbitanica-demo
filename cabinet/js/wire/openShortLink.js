// /cabinet/js/wire/openShortLink.js
// Відкриття сцени за коротким кодом і МИТТЄВЕ відтворення без кліків по «Розрахувати».
// Підтримує '?s=CODE' та '/s/CODE'. Основний шлях: orbit.applyScene(...).
// Запасний шлях для history: «тихий» програвач через onHistoryCalculate().

import { getSceneByCode } from '/cabinet/js/cloud/scenes.cloud.js';
import { onHistoryCalculate } from '/js/events/history_buttons.js';
import { t } from '/js/i18n.js';

// Поки що підтримуємо один режим явно
const SUPPORTED_MODES = ['history'];

/* ====================== Службові UI-хелпери ====================== */
function openInfoModal(titleText, bodyText) {
  const id = 'cab-info-overlay';
  document.getElementById(id)?.remove();

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'cab-modal-overlay';
  overlay.addEventListener('click', (e)=>{ if (e.target === overlay) overlay.remove(); });

  const box = document.createElement('div');
  box.className = 'cab-modal';
  box.setAttribute('role','dialog');
  box.setAttribute('aria-modal','true');
  box.setAttribute('aria-label', titleText || '');

  const h = document.createElement('h3');
  h.className = 'cab-modal-title';
  h.textContent = titleText || '';

  const p = document.createElement('p');
  p.className = 'cab-hint';
  p.textContent = bodyText || '';

  const actions = document.createElement('div');
  actions.className = 'cab-actions';

  const btnClose = document.createElement('button');
  btnClose.className = 'cab-btn';
  btnClose.textContent = t('cab_save_btn_close') || 'Close';
  btnClose.addEventListener('click', ()=> overlay.remove());

  actions.appendChild(btnClose);
  box.appendChild(h);
  box.appendChild(p);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showLoader() {
  const el = document.createElement('div');
  el.id = 'scene-loading-indicator';
  el.className = 'scene-loading-indicator';
  el.textContent = t('cab_loading') || 'Loading scene...';
  document.body.appendChild(el);
  return () => el.remove();
}

/* ====================== Код з URL ====================== */
function readShortCodeFromUrl() {
  const url = new URL(location.href);
  const fromQuery = url.searchParams.get('s');
  if (fromQuery) return fromQuery.trim();

  const path = location.pathname || '';
  if (path.startsWith('/s/')) {
    let rest = path.slice(3);
    rest = rest.split('?')[0].split('#')[0];
    const code = rest.split('/')[0];
    return decodeURIComponent((code || '').trim());
  }
  return null;
}

/* ====================== Маленькі DOM-хелпери для «Історії» ====================== */
function setDetailsOpen(id) {
  const det = document.getElementById(id);
  if (det && 'open' in det) det.open = true;
}

function setSelectValue(id, value, label) {
  if (value == null) return;
  const sel = document.getElementById(id);
  if (!sel || sel.tagName !== 'SELECT') return;

  const val = String(value);
  let has = false;
  for (const o of sel.options) {
    if (String(o.value) === val) { has = true; break; }
  }
  if (!has) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label != null ? String(label) : val;
    sel.appendChild(opt);
  }
  sel.value = val;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}

function setNumberInput(id, n) {
  if (n == null) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.value = String(n);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ====================== Міграції формату сцени ====================== */
function migrateQueryIfNeeded(q) {
  if (!q || !q.history) return q;

  // v1 → v2: перенесення одиночного o2 у масив o2s
  if (q.version === 1 && q.history.o2 && !Array.isArray(q.history.o2s)) {
    q = JSON.parse(JSON.stringify(q));
    q.version = 2;
    q.history.o2s = [q.history.o2];
  }
  return q;
}

/* ====================== «Тихий» програвач для history (fallback) ====================== */
/**
 * Відтворює сцену Історії без кліків:
 *  - підставляє О1 (категорія, об'єкт, базовий діаметр);
 *  - послідовно підставляє кожний О2 і викликає onHistoryCalculate({scope});
 *  - інфопанель лише доповнюється; форма і кнопки не чіпаються.
 */
async function applyHistorySilent(history) {
  if (!history?.o1) return { count: 0 };

  // 1) О1
  setDetailsOpen('history');
  setSelectValue('histCategoryObject1', history.o1.categoryKey, history.o1.categoryKey);
  setSelectValue('histObject1',         history.o1.objectId,   history.o1.name);
  setNumberInput('historyBaselineDiameter', history.o1.baselineDiameterMeters);

  // 2) О2 (масив; з сумісністю через history.o2)
  const o2s = Array.isArray(history.o2s) && history.o2s.length
    ? history.o2s
    : (history.o2 ? [history.o2] : []);

  if (!o2s.length) return { count: 0 };

  // 3) Послідовне застосування кожного О2 «тихо»
  const scope = document.getElementById('history') || document;
  for (const item of o2s) {
    if (!item) continue;
    setSelectValue('histCategoryObject2', item.categoryKey, item.categoryKey);
    setSelectValue('histObject2',         item.objectId,   item.name);
    try {
      onHistoryCalculate({ scope });
    } catch (e) {
      console.error('[openShortLink] onHistoryCalculate failed for O2:', item, e);
    }
    // Дрібна пауза, щоб дати UI перемалюватися між кроками
    await new Promise(r => setTimeout(r, 0));
  }

  return { count: o2s.length };
}

/* ====================== Головний старт ====================== */
async function bootstrap() {
  const code = readShortCodeFromUrl();
  if (!code) return;

  const hideLoader = showLoader();

  try {
    const scene = await getSceneByCode(code);
    if (!scene) {
      openInfoModal('404', t('cab_save_not_supported_body') || 'Scene not found or not public.');
      return;
    }

    const q = migrateQueryIfNeeded(scene.query || scene);

    if (!SUPPORTED_MODES.includes(q.mode)) {
      openInfoModal('Error', `Mode "${q.mode}" is not supported.`);
      return;
    }

    // Дамо шанс іншим частинам UI підхопити подію
    document.dispatchEvent(new CustomEvent('cabinet:scene-loaded', { detail: { scene, code, query: q } }));

    // Основний шлях: централізований аплаєр
    if (window?.orbit?.applyScene) {
      await window.orbit.applyScene(q);
    } else if (q.mode === 'history' && q.history) {
      // Запасний шлях: «тихий» програвач без кліків
      await applyHistorySilent(q.history);
    }

    // Приберемо '?s=' із адресного рядка (щоб не заважав далі)
    const url = new URL(location.href);
    if (url.searchParams.has('s')) {
      url.searchParams.delete('s');
      history.replaceState({}, '', url);
    }
  } catch (e) {
    console.error('[openShortLink] failed:', e);
    let message = t('cab_error_open_scene') || 'Failed to open the scene.';
    const m = String(e?.message || '');
    if (m.toLowerCase().includes('network')) {
      message = t('cab_error_network') || 'Network error. Please check your connection.';
    }
    openInfoModal('Error', message);
  } finally {
    hideLoader();
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
