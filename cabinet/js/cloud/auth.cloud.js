// /cabinet/js/cloud/auth.cloud.js
// API для входу через лист (magic link) та виходу.
// Використання у UI: import { signInWithEmail, signOut, getSession, watchAuth } from './auth.cloud.js';

import { getSupabase } from './config.js';

/** Валідація email (проста, але надійна для UI) */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/** Map повідомлень Supabase у зрозумілий текст (можна замінити на i18n) */
/** Створює помилку з кодом та додатковими полями (для UI) */
function makeAuthError(code, message, extra = {}) {
  const e = new Error(message || code);
  e.code = code;
  Object.assign(e, extra);
  return e;
}

/** Нормалізація помилок від Supabase у стабільні коди для UI */
function mapSupabaseError(error) {
  if (!error) return makeAuthError('generic', 'Unknown auth error');

  const rawMsg = String(error.message || '');
  const msg = rawMsg.toLowerCase();

  // Типовий ліміт: "For security purposes, you can only request this after 54 seconds."
  const m = /only request this after\s+(\d+)\s+seconds/i.exec(rawMsg);
  if (error.status === 429 || m) {
    const seconds = m ? Number(m[1]) : undefined;
    return makeAuthError('cooldown', 'Cooldown in effect', seconds ? { seconds } : {});
  }

  if (msg.includes('invalid') && msg.includes('email')) {
    return makeAuthError('invalid_email', 'Invalid email');
  }

  if (msg.includes('expired')) {
    return makeAuthError('link_expired', 'Magic link expired');
  }

  return makeAuthError('generic', rawMsg || 'Auth error');
}


/**
 * Надіслати лист для входу (magic link).
 * Повертає: { ok:true } або кидає Error із зрозумілим message.
 */
export async function signInWithEmail(email) {
  if (!isValidEmail(email)) {
    throw makeAuthError('invalid_email', 'Invalid email');
  }
  const supabase = await getSupabase();

  const { error } = await supabase.auth.signInWithOtp({
    email: String(email).trim(),
    options: {
      emailRedirectTo: window.location.origin + '/',
      shouldCreateUser: true
    }
  });

  if (error) throw mapSupabaseError(error);
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
