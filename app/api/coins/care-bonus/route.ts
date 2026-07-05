import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
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

  const newCoins = (profile?.coins ?? 0) + COINS_CARE_PER_LOG;
  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  await svc.from("profiles").update({
    coins: newCoins,
    last_care_coin_date: today,
    care_coin_count_today: countToday + 1,
  }).eq("id", user.id);

  return NextResponse.json({ awarded: true, coins: newCoins, bonus: COINS_CARE_PER_LOG, count_today: countToday + 1 });
}
