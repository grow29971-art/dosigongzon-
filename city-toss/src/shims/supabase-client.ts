import type { createBrowserClient } from "@supabase/ssr";
import { supabase } from "../lib/supabase";
// 본 앱 @/lib/supabase/client 대체 — localStorage 세션 클라이언트 하나를 모든 repo가 공유한다.
// 타입은 본 앱(@supabase/ssr createBrowserClient)과 동일하게 맞춘다(타입만 import, 런타임 의존 없음).
export type AnyClient = ReturnType<typeof createBrowserClient>;
export function createClient(): AnyClient { return supabase() as unknown as AnyClient; }
