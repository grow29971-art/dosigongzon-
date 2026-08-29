// 주간 돌봄 포인트 수령 API
// 이번 주(KST 월~일) '실제 돌봄일지를 남긴 날' 수 기준 마일스톤 포인트 지급.
// 2026-08-29 게임 요소(코인·다마고치·일일출석체크) 제거로, 출석 스탬프(checkin_days) 대신
// care_logs의 서로 다른 KST 날짜 수를 집계원으로 사용 — 실제 돌봄이 곧 쇼핑 할인 적립.
// 3일 50P / 5일 100P / 7일 150P — point_ledger의 (user, reason) 유니크로 중복 지급 원천 차단.
// 포인트는 쇼핑몰 결제 시 1P = 1원 할인. 실돈 부채라 적립량은 보수적으로 유지.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { thisMondayKstISO, thisMondayKstDate, toKstDate, isoWeekKey } from "@/lib/kst";

// (라우트 파일은 핸들러 외 export 금지 — WeeklyCheckinCard가 같은 값을 복제 보유)
const MILESTONES: { days: number; points: number }[] = [
  { days: 3, points: 50 },
  { days: 5, points: 100 },
  { days: 7, points: 150 },
];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 지급은 어차피 멱등이지만, 스팸 호출로 인한 DB 부하 방지
  if (!rateLimit(`claim-weekly:${user.id}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "요청이 너무 많아요." }, { status: 429 });
  }

  const svc = createServiceClient();

  // 이번 주(KST 월~일) 돌봄일지의 서로 다른 KST 날짜 수를 집계.
  // 주 시작(월 0시 KST)의 UTC 경계 이후 logged_at만 조회 후, KST 달력일로 유일화한다.
  const weekKey = isoWeekKey(thisMondayKstDate());
  const weekStartIso = thisMondayKstISO();
  const { data: logs, error: logsError } = await svc
    .from("care_logs")
    .select("logged_at")
    .eq("author_id", user.id)
    .gte("logged_at", weekStartIso);
  if (logsError) {
    console.error("[points/claim-weekly] care_logs query failed:", logsError);
    return NextResponse.json({ error: "돌봄 정보를 불러올 수 없어요." }, { status: 500 });
  }

  const dayCount = new Set(
    (logs ?? []).map((r: { logged_at: string }) => toKstDate(r.logged_at)),
  ).size;
  let granted = 0;
  const grantedMilestones: number[] = [];
  for (const m of MILESTONES) {
    if (dayCount < m.days) continue;
    const { data: ok, error } = await svc.rpc("grant_points", {
      p_user_id: user.id,
      p_amount: m.points,
      p_reason: `weekly:${weekKey}:m${m.days}`,
      p_note: `주간 출석 ${m.days}일 달성`,
    });
    if (error) {
      console.error("[points/claim-weekly] grant failed:", error);
      continue;
    }
    if (ok === true) {
      granted += m.points;
      grantedMilestones.push(m.days);
    }
  }

  const { data: pointRow } = await svc
    .from("user_points").select("balance").eq("user_id", user.id).maybeSingle();

  return NextResponse.json({
    ok: true,
    days: dayCount,
    granted,
    grantedMilestones,
    balance: (pointRow as { balance: number } | null)?.balance ?? 0,
  });
}
