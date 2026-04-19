// Cookie-less anonymous Supabase client (공개 읽기 전용).
// ISR/SSG 페이지에서 쓰기 위해 cookies()를 건드리지 않음.
// RLS는 공개 SELECT 정책에 의존.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
