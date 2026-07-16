import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { COINS_CARE_PER_LOG, COINS_CARE_DAILY_CAP, kstDateString } from "@/lib/shop-config";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("coins,last_care_coin_date,care_coin_count_today")
    .eq("id", user.id)
    .maybeSingle();

  const today = kstDateString();
  const sameDay = profile?.last_care_coin_date === today;
  const countToday = sameDay ? (profile?.care_coin_count_today ?? 0) : 0;

  if (countToday >= COINS_CARE_DAILY_CAP) {
    return NextResponse.json({ awarded: false, reason: "daily_cap_reached", coins: profile?.coins ?? 0 });
  }

  // 실제로 오늘 돌봄일지를 남겼는지 서버에서 직접 확인 — 예전엔 이 확인 없이 그냥
  // POST만 오면 지급해서, 돌봄일지 한 번도 안 쓰고 이 엔드포인트만 반복 호출하면
  // 하루 최대 10코인을 공짜로 받아갈 수 있었음.
  const dayStart = new Date(`${today}T00:00:00+09:00`).toISOString();
  const dayEnd = new Date(`${today}T23:59:59.999+09:00`).toISOString();
  const { count: realCareCount } = await supabase
    .from("care_logs")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .gte("logged_at", dayStart)
    .lte("logged_at", dayEnd);

  const eligibleCount = Math.min(realCareCount ?? 0, COINS_CARE_DAILY_CAP);
  if (eligibleCount <= countToday) {
    return NextResponse.json({ awarded: false, reason: "no_new_care_log", coins: profile?.coins ?? 0 });
  }

  const svc = createServiceClient();

  // 검증·카운터 증가·코인 지급을 DB 트랜잭션(FOR UPDATE)에서 한 번에 —
  // 동시 요청이 같은 count_today를 읽고 이중 지급하던 레이스 차단.
  const { data: rpcRes, error: rpcErr } = await svc.rpc("award_care_bonus_atomic", {
    p_user_id: user.id,
    p_amount: COINS_CARE_PER_LOG,
    p_today: today,
    p_cap: COINS_CARE_DAILY_CAP,
    p_eligible: eligibleCount,
  });
  if (!rpcErr && rpcRes) {
    const r = rpcRes as { awarded?: boolean; reason?: string; coins?: number; count_today?: number; error?: string };
    if (r.error) return NextResponse.json({ awarded: false, reason: r.error, coins: profile?.coins ?? 0 });
    if (!r.awarded) return NextResponse.json({ awarded: false, reason: r.reason, coins: r.coins ?? 0 });
    return NextResponse.json({ awarded: true, coins: r.coins ?? 0, bonus: COINS_CARE_PER_LOG, count_today: r.count_today ?? countToday + 1 });
  }

  // RPC 미실행 환경 폴백 — 기존 read-modify-write (마이그레이션 실행 후엔 위 경로만 탐)
  console.warn("[coins/care-bonus] ⚠️ award_care_bonus_atomic RPC 미배포/오류 — 비원자 폴백. 마이그레이션 확인 필요.");
  const newCoins = (profile?.coins ?? 0) + COINS_CARE_PER_LOG;
  await svc.from("profiles").update({
    coins: newCoins,
    last_care_coin_date: today,
    care_coin_count_today: countToday + 1,
  }).eq("id", user.id);

  return NextResponse.json({ awarded: true, coins: newCoins, bonus: COINS_CARE_PER_LOG, count_today: countToday + 1 });
}
