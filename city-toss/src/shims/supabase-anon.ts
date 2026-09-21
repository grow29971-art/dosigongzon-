/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
// 본 앱 @/lib/supabase/anon 대체 — 미니앱은 항상 로그인 상태라 같은 클라이언트를 쓴다(RLS가 더 넓게 열릴 뿐).
export function createAnonClient(): SupabaseClient<any, "public", any> { return supabase() as unknown as SupabaseClient<any, "public", any>; }
