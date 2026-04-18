// ══════════════════════════════════════════
// 서버 사이드 cats 조회 (RSC/라우트 핸들러 전용)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/server";
import type { Cat } from "@/lib/cats-repo";

export async function getCatByIdServer(id: string): Promise<Cat | null> {
  // UUID 형식이 아니면 즉시 null (400 회피)
  if (!/^[0-9a-fA-F-]{32,36}$/.test(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cats")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[cats-server] getCatByIdServer failed:", error);
    return null;
  }
  return (data as Cat | null) ?? null;
}

export async function getCatCommentsCountServer(id: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("cat_comments")
    .select("*", { count: "exact", head: true })
    .eq("cat_id", id);
  return count ?? 0;
}

export async function getCatCareLogsCountServer(id: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("care_logs")
    .select("*", { count: "exact", head: true })
    .eq("cat_id", id);
  return count ?? 0;
}
