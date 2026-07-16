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

  const svc = createServiceClient();

  // 원자적 선점 — 동시 요청 중 하나만 통과 (보너스 이중 지급 차단, checkin과 동일 패턴)
  const { data: claimedRows } = await svc
    .from("profiles")
    .update({ last_login_bonus_date: today })
    .eq("id", user.id)
    .or(`last_login_bonus_date.is.null,last_login_bonus_date.neq.${today}`)
    .select("id");
  if (!claimedRows || claimedRows.length === 0) {
    return NextResponse.json({ awarded: false, coins: profile?.coins ?? 0 });
  }

  // 코인은 DB에서 원자 증감 — RPC 미실행 환경에선 기존 read-modify-write 폴백
  let coins = (profile?.coins ?? 0) + COINS_LOGIN_BONUS;
  const { data: rpcCoins, error: rpcErr } = await svc.rpc("increment_coins", {
    p_user_id: user.id, p_amount: COINS_LOGIN_BONUS,
  });
  if (rpcErr) {
    await svc.from("profiles").update({ coins }).eq("id", user.id);
  } else if (typeof rpcCoins === "number") {
    coins = rpcCoins;
  }

  return NextResponse.json({ awarded: true, coins, bonus: COINS_LOGIN_BONUS });
}
