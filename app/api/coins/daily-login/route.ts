import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { COINS_LOGIN_BONUS, kstDateString } from "@/lib/shop-config";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("coins,last_login_bonus_date")
    .eq("id", user.id)
    .maybeSingle();

  const today = kstDateString();
  if (profile?.last_login_bonus_date === today) {
    return NextResponse.json({ awarded: false, coins: profile?.coins ?? 0 });
  }

  const newCoins = (profile?.coins ?? 0) + COINS_LOGIN_BONUS;
  const svc = createServiceClient();
  await svc.from("profiles").update({ coins: newCoins, last_login_bonus_date: today }).eq("id", user.id);

  return NextResponse.json({ awarded: true, coins: newCoins, bonus: COINS_LOGIN_BONUS });
}
