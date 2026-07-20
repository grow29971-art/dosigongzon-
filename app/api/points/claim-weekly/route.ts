// 주간 출석 포인트 수령 API
// 이번 주(KST 월~일) 출석체크 완료 일수 기준 마일스톤 포인트 지급.
// 3일 50P / 5일 100P / 7일 150P — point_ledger의 (user, reason) 유니크로 중복 지급 원천 차단.
// 포인트는 쇼핑몰 결제 시 1P = 1원 할인. 실돈 부채라 적립량은 보수적으로 유지
// (2026-07-20 100/200/300 → 50/100/150 하향 — 주 최대 600P가 쇼핑몰 부담이 컸음).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";

export const MILESTONES: { days: number; points: number }[] = [
  { days: 3, points: 50 },
  { days: 5, points: 100 },
  { days: 7, points: 150 },
];

// KST 기준 이번 주 월요일 날짜 + ISO 주차 키 (예: 2026-W29)
function kstWeekInfo(): { monday: string; weekKey: string } {
  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const dow = (kstNow.getDay() + 6) % 7; // 월=0 … 일=6
  const monday = new Date(kstNow);
  monday.setDate(kstNow.getDate() - dow);
  const mondayStr = monday.toLocaleDateString("en-CA");
  // ISO 주차 계산 (목요일 기준)
  const thu = new Date(monday);
  thu.setDate(monday.getDate() + 3);
  const jan1 = new Date(thu.getFullYear(), 0, 1);
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return { monday: mondayStr, weekKey: `${thu.getFullYear()}-W${String(week).padStart(2, "0")}` };
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 지급은 어차피 멱등이지만, 스팸 호출로 인한 DB 부하 방지
  if (!rateLimit(`claim-weekly:${user.id}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "요청이 너무 많아요." }, { status: 429 });
  }

  const svc = createServiceClient();

  const { monday, weekKey } = kstWeekInfo();
  const { data: days, error: daysError } = await svc
    .from("checkin_days")
    .select("day")
    .eq("user_id", user.id)
    .gte("day", monday);
  if (daysError) {
    console.error("[points/claim-weekly] checkin_days query failed:", daysError);
    return NextResponse.json({ error: "출석 정보를 불러올 수 없어요." }, { status: 500 });
  }

  const dayCount = (days ?? []).length;
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
