// full/js/ui/ip_text_history.js
'use strict';

import { t } from '../i18n.js';

/** Локалізований ярлик для діапазону події */
function variantLabel(variant) {
  if (variant === 'start') return t('history.range.start');   // "початок"
  if (variant === 'end')   return t('history.range.end');     // "завершення"
  return '';
}

/** Акуратно приводимо рік до рядка (підтримує від'ємні значення) */
function fmtYear(year) {
  if (year == null) return '';
  const n = Number(year);
  if (!Number.isFinite(n)) return '';
  return String(n);
}

/**
 * Назва елемента для інфопанелі/лейбла.
 * Зараз: "Подія — початок (1914)" або "Подія (1914)".
 * Використовується існуючим кодом (НЕ ЛАМАЄМО).
 */
export function formatHistoryItemName(name, variant = null, year = null) {
  const base = String(name || '').trim();
  const v = variantLabel(variant);
  const y = fmtYear(year);

  if (v && y) return `${base} \u2014 ${v} (${y})`;
  if (!v && y) return `${base} (${y})`;
  return base;
}

/**
 * Текст для лейбла біля кола (залишаємо як є, щоб мапа лишилася інформативною).
 */
export function formatHistoryCircleLabel(name, year = null, variant = null) {
  const base = String(name || '').trim();
  if (variant === 'start') return `⊢ ${base}`;
  if (variant === 'end')   return `⊣ ${base}`;
  return base;
}




/**
 * Формує підзаголовок “лівий → правий”
 */
export function formatHistorySubtitle(leftKey, rightKey) {
  const left = leftKey ? t(leftKey) : '';
  const right = rightKey ? t(rightKey) : '';
  if (left && right) return `${left} \u2192 ${right}`;
  return left || right || '';
}

/**
 * НОВЕ: Заголовок групи історичної події (без року/варіанта).
 * Використаємо у режимі групування: один заголовок + підрядки.
 */
export function formatHistoryGroupTitle(name) {
  return String(name || '').trim();
}

/**
 * НОВЕ: Префікс для підрядка групи: "— початок:" / "— завершення:"
 * Рік та значення додає рендерер інфопанелі (щоб уникнути дубляжу "рік").
 */
export function formatHistoryVariantPrefix(variant) {
  if (variant === 'start') return '⊢';  // початок
  if (variant === 'end')   return '⊣';  // кінець
  return '—';                           // одинична подія (без діапазону)
}
