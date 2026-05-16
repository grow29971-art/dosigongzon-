// ══════════════════════════════════════════
// 도시공존 — 케어테이커 활동 랭킹 Repository
// Supabase RPC: get_top_caretakers, get_caretaker_rank
// 활동 점수: cat * 10 + comment + alert * 2 + likes_received * 2 + care_log * 2
// ══════════════════════════════════════════

import { createAnonClient } from "@/lib/supabase/anon";

export interface RankingRow {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  cat_count: number;
  comment_count: number;
  care_count: number;
  likes_received: number;
  score: number;
  rank: number;
}

export interface MyRankRow {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  cat_count: number;
  comment_count: number;
  care_count: number;
  score: number;
  rank: number;
  total_users: number;
}

// 상위 N명 (anon 클라이언트로 조회 — 랭킹은 공개)
export async function getTopCaretakersServer(limitN = 50): Promise<RankingRow[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("get_top_caretakers", { limit_n: limitN });
  if (error) {
    console.error("[ranking-repo] get_top_caretakers failed:", error);
    return [];
  }
  return (data ?? []) as RankingRow[];
}

// 본인 순위 (Top N에 못 든 경우 별도 표시용)
export async function getMyRankServer(userId: string): Promise<MyRankRow | null> {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("get_caretaker_rank", { target_user_id: userId });
  if (error) {
    console.error("[ranking-repo] get_caretaker_rank failed:", error);
    return null;
  }
  const rows = (data ?? []) as MyRankRow[];
  return rows.length > 0 ? rows[0] : null;
}
