import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 미니앱 전용 Supabase 클라이언트 — 본 앱(@supabase/ssr 쿠키 기반)과 달리 토큰을 localStorage에 둔다.
// iOS WebView는 서드파티 쿠키를 막으므로(앱인토스 FAQ) 쿠키 세션은 쓸 수 없다.
// anon 키는 공개 값이고 권한은 전부 RLS가 결정한다 — service_role은 절대 여기 오지 않는다.
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 없어요.");
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "dosigongzon-toss-auth",
    },
  });
  return client;
}

export const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? "https://dosigongzon.com").replace(/\/$/, "");
