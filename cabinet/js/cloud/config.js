// /cabinet/js/cloud/config.js
// Єдиний клієнт Supabase у всьому браузерному контексті (стійко до повторного завантаження модулів)

export const SUPABASE_URL =
  'https://zvawceuclhsfsjqgioso.supabase.co';

export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YXdjZXVjbGhzZnNqcWdpb3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5Nzc4NzAsImV4cCI6MjA3MjU1Mzg3MH0.J7IktLl_7nUO1beXOwgpQBOpuy6TRlZTQSLXCo7IdFk';

// Куди повертаємося після кліку в листі (має бути у Allow-list Supabase)
export const EMAIL_REDIRECT_TO = new URL('/', window.location.origin).toString();

// Глобальний ключ для кешу клієнта (уникає дублювання при HMR/повторних імпортах)
const SB_GLOBAL_KEY = '__orbitanica_supabase_client__';

function authOptions() {
  return {
    auth: {
      // Фіксований storageKey, щоб не плодити декілька GoTrueClient під одним ключем
      storageKey: 'orbitanica-auth-v1',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  };
}

/** Повертає один-єдиний Supabase-клієнт у всьому вікні */
export async function getSupabase() {
  const g = globalThis; // window у браузері
  if (g[SB_GLOBAL_KEY]) return g[SB_GLOBAL_KEY];

  // Підтягуємо SDK v2 як ESM з CDN (той самий шлях скрізь)
  const { createClient } = await import(
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
  );

  g[SB_GLOBAL_KEY] = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, authOptions());
  return g[SB_GLOBAL_KEY];
}
