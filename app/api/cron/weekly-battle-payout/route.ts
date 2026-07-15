// 주간 배틀 랭킹 코인 지급 — Vercel Cron 매주 월요일 08:00 KST (일 23:00 UTC)
// 지난 주(월~일, KST) card_battles 참가자를 승3점/패1점으로 집계해 TOP 10에게 코인 지급.

import { createServiceClient } from "@/lib/supabase/service";
import { WEEKLY_RANK_REWARDS } from "@/lib/shop-config";

interface BattleRow {
  challenger_id: string | null;
  opponent_id: string | null;
  winner_id: string | null;
}

// 이번 주 월요일 0시(KST)의 UTC Date
function mondayKst(offsetWeeks: number): Date {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kstNow.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const kstMon = new Date(kstNow);
  kstMon.setHours(0, 0, 0, 0);
  kstMon.setDate(kstMon.getDate() - daysSinceMonday + offsetWeeks * 7);
  const offsetMinutes = new Date().getTimezoneOffset() - -540;
  return new Date(kstMon.getTime() - offsetMinutes * 60 * 1000);
}

async function handle(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }
  const supabase = createServiceClient();

  const lastMonday = mondayKst(-1);
  const thisMonday = mondayKst(0);

  const { data, error } = await supabase
    .from("card_battles")
    .select("challenger_id, opponent_id, winner_id")
    .gte("created_at", lastMonday.toISOString())
    .lt("created_at", thisMonday.toISOString())
    .limit(10000);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const scoreMap = new Map<string, number>();
  for (const row of (data ?? []) as BattleRow[]) {
    const uids = new Set([row.challenger_id, row.opponent_id].filter((v): v is string => !!v));
    for (const uid of uids) {
      const pts = row.winner_id === uid ? 3 : 1;
      scoreMap.set(uid, (scoreMap.get(uid) ?? 0) + pts);
    }
  }

  const top = Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, WEEKLY_RANK_REWARDS.length);

  const payouts: { user_id: string; score: number; reward: number }[] = [];
  for (let i = 0; i < top.length; i++) {
    const [userId, score] = top[i];
    const reward = WEEKLY_RANK_REWARDS[i];
    const { data: profile } = await supabase.from("profiles").select("coins").eq("id", userId).maybeSingle();
    const newCoins = (profile?.coins ?? 0) + reward;
    await supabase.from("profiles").update({ coins: newCoins }).eq("id", userId);
    payouts.push({ user_id: userId, score, reward });
  }

  return Response.json({ ok: true, week_start: lastMonday.toISOString(), payouts });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
