// ══════════════════════════════════════════
// 쇼핑 수익 사용처 투표 Repository
// public.fund_vote_options / fund_votes + RPC(cast_fund_vote, fund_vote_results)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

// 비로그인 투표 식별자 — 브라우저/기기 단위(1기기 1표, 캐주얼 중복만 방지).
const ANON_ID_KEY = "dosigongzon_anon_id";
const ANON_VOTE_KEY = "dosigongzon_fund_vote"; // 비로그인 내 선택(표시용)

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* 폴백 */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export interface FundVoteOption {
  id: string;
  label: string;
  emoji: string | null;
  sort_order: number;
}

export interface FundVoteState {
  options: FundVoteOption[];
  counts: Record<string, number>; // option_id → 득표수
  total: number;
  myVote: string | null; // 내가 투표한 option_id
}

// 항목 + 집계 + 내 투표를 한 번에 로드 (마이그레이션 전이면 options 빈 배열)
export async function loadFundVote(): Promise<FundVoteState> {
  const supabase = createClient();
  const [optRes, resultRes, meRes] = await Promise.all([
    supabase.from("fund_vote_options").select("id, label, emoji, sort_order").order("sort_order"),
    supabase.rpc("fund_vote_results"),
    supabase.auth.getUser(),
  ]);

  const options = (optRes.data ?? []) as FundVoteOption[];
  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of (resultRes.data ?? []) as { option_id: string; votes: number }[]) {
    counts[r.option_id] = Number(r.votes);
    total += Number(r.votes);
  }

  let myVote: string | null = null;
  const user = meRes.data.user;
  if (user) {
    const { data: mine } = await supabase
      .from("fund_votes")
      .select("option_id")
      .eq("user_id", user.id)
      .maybeSingle();
    myVote = (mine as { option_id: string } | null)?.option_id ?? null;
  } else {
    // 비로그인: 내 선택은 localStorage에 보관한 값으로 표시
    try { myVote = localStorage.getItem(ANON_VOTE_KEY); } catch { /* 무시 */ }
  }

  return { options, counts, total, myVote };
}

// 투표(변경 포함). 로그인 유저는 cast_fund_vote, 비로그인은 cast_fund_vote_anon(기기 단위). 오류 시 예외.
export async function castFundVote(optionId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { error } = await supabase.rpc("cast_fund_vote", { p_option_id: optionId });
    if (error) throw new Error(error.message);
    return;
  }
  // 비로그인 — 기기 식별자 기준 1표
  const { error } = await supabase.rpc("cast_fund_vote_anon", {
    p_option_id: optionId,
    p_anon_id: getAnonId(),
  });
  if (error) throw new Error(error.message);
  try { localStorage.setItem(ANON_VOTE_KEY, optionId); } catch { /* 무시 */ }
}
