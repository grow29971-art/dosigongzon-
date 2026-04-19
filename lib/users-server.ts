// ══════════════════════════════════════════
// 서버 사이드 유저 프로필 조회
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/server";
import type { Cat } from "@/lib/cats-repo";

export interface PublicUserProfile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  admin_title: string | null;
  created_at: string;
}

export async function getUserProfileServer(id: string): Promise<PublicUserProfile | null> {
  if (!/^[0-9a-fA-F-]{32,36}$/.test(id)) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nickname, email, avatar_url, admin_title, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  const row = data as {
    id: string;
    nickname: string | null;
    email: string | null;
    avatar_url: string | null;
    admin_title: string | null;
    created_at: string;
  };

  return {
    id: row.id,
    nickname: row.nickname ?? row.email?.split("@")[0] ?? "익명",
    avatar_url: row.avatar_url,
    admin_title: row.admin_title,
    created_at: row.created_at,
  };
}

export async function getUserFollowCountsServer(id: string): Promise<{ followers: number; following: number }> {
  const supabase = await createClient();
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", id),
    supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
  ]);
  return { followers: followers ?? 0, following: following ?? 0 };
}

export async function getUserCatsServer(id: string, limit = 20): Promise<Cat[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cats")
    .select("*")
    .eq("caretaker_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Cat[];
}

export async function getUserCareLogCountServer(id: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("care_logs")
    .select("*", { count: "exact", head: true })
    .eq("author_id", id);
  return count ?? 0;
}
