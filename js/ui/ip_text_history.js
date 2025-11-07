// /js/ui/ip_text_history.js
'use strict';

/**
 * Мінімальні форматери для режиму «Історія».
 * Без локалей та i18n.
 * Усі дати — це роки (цілі), без розділювачів тисяч.
 */

export function formatHistoryGroupTitle(title) {
  return String(title ?? '').trim();
}

export function formatHistoryVariantPrefix(variant) {
  return variant === 'start' ? '['
       : variant === 'end'   ? ']'
       : '—';
}

export function formatHistoryRealValue(value /*, unit, lang */) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const y = Math.trunc(n); // цілий рік, знак зберігається
  return `${y} рік`;
}
