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

  const newCoins = (profile?.coins ?? 0) + COINS_CARE_PER_LOG;
  const svc = createServiceClient();
  await svc.from("profiles").update({
    coins: newCoins,
    last_care_coin_date: today,
    care_coin_count_today: countToday + 1,
  }).eq("id", user.id);

  return NextResponse.json({ awarded: true, coins: newCoins, bonus: COINS_CARE_PER_LOG, count_today: countToday + 1 });
}
