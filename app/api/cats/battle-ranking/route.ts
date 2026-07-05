import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";

// card_battles의 RLS는 "본인 배틀만 조회"라 랭킹 집계는 service_role로만 가능.
// 이번 주(월~일, KST) 참가자별 승3점/패1점 집계.
function thisMondayKstISO(): string {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kstNow.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const kstMon = new Date(kstNow);
  kstMon.setHours(0, 0, 0, 0);
  kstMon.setDate(kstMon.getDate() - daysSinceMonday);
  const offsetMinutes = new Date().getTimezoneOffset() - -540;
  return new Date(kstMon.getTime() - offsetMinutes * 60 * 1000).toISOString();
}

interface BattleRow {
  challenger_id: string | null;
  opponent_id: string | null;
  winner_id: string | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const since = thisMondayKstISO();
  const { data, error } = await svc
    .from("card_battles")
    .select("challenger_id, opponent_id, winner_id")
    .gte("created_at", since)
    .limit(10000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const scoreMap = new Map<string, { wins: number; losses: number }>();
  for (const row of (data ?? []) as BattleRow[]) {
    const uids = new Set([row.challenger_id, row.opponent_id].filter((v): v is string => !!v));
    for (const uid of uids) {
      const cur = scoreMap.get(uid) ?? { wins: 0, losses: 0 };
      if (row.winner_id === uid) cur.wins += 1; else cur.losses += 1;
      scoreMap.set(uid, cur);
    }
  }

  const userIds = Array.from(scoreMap.keys());
  if (userIds.length === 0) return NextResponse.json({ ranks: [] });

  const { data: profiles } = await svc
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", userIds);
  const profileMap = new Map(
    ((profiles ?? []) as { id: string; nickname: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]),
  );

  const ranked = userIds
    .map((uid) => {
      const s = scoreMap.get(uid)!;
      const p = profileMap.get(uid);
      return {
        userId: uid,
        name: p?.nickname ?? "익명",
        avatarUrl: p?.avatar_url ?? null,
        score: s.wins * 3 + s.losses * 1,
        wins: s.wins,
        losses: s.losses,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return NextResponse.json({ ranks: ranked });
}
