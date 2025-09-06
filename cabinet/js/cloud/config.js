// /cabinet/js/cloud/config.js
// Єдина точка створення клієнта Supabase (браузер, ES-модулі).
// Використання: import { getSupabase, EMAIL_REDIRECT_TO } from './config.js';

export const SUPABASE_URL =
  'https://zvawceuclhsfsjqgioso.supabase.co';

export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YXdjZXVjbGhzZnNqcWdpb3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5Nzc4NzAsImV4cCI6MjA3MjU1Mzg3MH0.J7IktLl_7nUO1beXOwgpQBOpuy6TRlZTQSLXCo7IdFk';

// Куди повертаємося після кліку в листі (має бути у Allow-list Supabase).
export const EMAIL_REDIRECT_TO = new URL('/', window.location.origin).toString();

let _client = null;

/**
 * Повертає singleton Supabase-клієнт.
 * Завантажує офіційний SDK як ESM з CDN (без збирача).
 */
export async function getSupabase() {
  if (_client) return _client;

  // Підтягуємо офіційний SDK (v2, ESM). Пін на мажорній версії.
  const { createClient } = await import(
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
  );

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,         // зберігаємо сесію в браузері
      autoRefreshToken: true,       // авто-оновлення токена
      detectSessionInUrl: true      // обробка коду після редіректу
    }
    // за потреби можна додати fetch або глобальні опції
  });

  return _client;
}
