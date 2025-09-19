// /cabinet/js/cloud/auth.cloud.js
// API для входу через лист (magic link) та виходу.
// Використання у UI: import { signInWithEmail, signOut, getSession, watchAuth } from './auth.cloud.js';

import { getSupabase } from './config.js';

/** Валідація email (проста, але надійна для UI) */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/** Map повідомлень Supabase у зрозумілий текст (можна замінити на i18n) */
function normalizeAuthError(error) {
  if (!error) return null;
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('rate')) return 'Too many requests. Try again later.';
  if (msg.includes('invalid') && msg.includes('email')) return 'Please enter a valid email.';
  if (msg.includes('expired')) return 'This link is no longer valid. Request a new one.';
  return error.message || 'Something went wrong. Please try again.';
}

/**
 * Надіслати лист для входу (magic link).
 * Повертає: { ok:true } або кидає Error із зрозумілим message.
 */
export async function signInWithEmail(email) {
  if (!isValidEmail(email)) {
    throw new Error('Please enter a valid email.');
  }
  const supabase = await getSupabase();

  const { error } = await supabase.auth.signInWithOtp({
    email: String(email).trim(),
    options: {
      emailRedirectTo: window.location.origin + '/',
      shouldCreateUser: true
    }
  });

  if (error) throw new Error(normalizeAuthError(error));
  return { ok: true };
}

/** Вийти з акаунта (очистити сесію у браузері). */
export async function signOut() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message || 'Sign out failed.');
  return { ok: true };
}

/** Отримати поточну сесію (або null). */
export async function getSession() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message || 'Session read failed.');
  return data?.session ?? null;
}

/** Отримати e-mail поточного користувача (або null). */
export async function getUserEmail() {
  const session = await getSession();
  return session?.user?.email ?? null;
}

/**
 * Підписатися на зміни аутентифікації.
 * callback({ event, session })
 * Повертає: функцію unsubscribe().
 */
export async function watchAuth(callback) {
  const supabase = await getSupabase();
  const { data: { subscription } } =
    supabase.auth.onAuthStateChange((event, session) => {
      try { callback?.({ event, session }); } catch { /* no-op */ }
    });
  return () => subscription.unsubscribe();
}
