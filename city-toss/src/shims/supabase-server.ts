/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
// 본 앱 @/lib/supabase/server 대체 — 서버 컴포넌트용 async createClient()를 같은 브라우저 클라이언트로.
// *-server.ts repo와 async 페이지 함수가 그대로 돌아간다(RLS는 동일). 타입은 본 앱 createServerClient 추론값과 동일.
type ServerClient = SupabaseClient<any, "public", any>;
export async function createClient(): Promise<ServerClient> { return supabase() as unknown as ServerClient; }
