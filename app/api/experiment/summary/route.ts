// GET /api/experiment/summary[?experimentId=]
// 참여자 대시보드 데이터 — 지역 전체 집계는 숫자만 내려준다 (다른 참여자의
// user_id·개별 기록은 RLS로도, 이 응답으로도 노출하지 않음).
// experimentId 생략 시 내가 가장 최근 참여한 실험을 사용.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { getExperiment, isOpenToday, isUuid, logExperimentEvent } from "@/lib/experiments-server";
import { computeStreakDays, dayDiff } from "@/lib/experiment-metrics";
import { kstToday, thisMondayKstDate } from "@/lib/kst";
import type { ExperimentActivityType, ExperimentSummary } from "@/lib/experiments-repo";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  if (!rateLimit(`exp-summary:${user.id}`, { max: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const svc = createServiceClient();
  const url = new URL(request.url);
  const requestedId = url.searchParams.get("experimentId");

  // 내 멤버십 확인 — 소속되지 않은 실험은 id를 알아도 조회 불가
  let membershipQuery = svc
    .from("experiment_members")
    .select("experiment_id, joined_at")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1);
  if (requestedId) {
    if (!isUuid(requestedId)) {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }
    membershipQuery = membershipQuery.eq("experiment_id", requestedId);
  }
  const { data: memberships } = await membershipQuery;
  const membership = memberships?.[0];
  if (!membership) {
    return NextResponse.json({ experiment: null });
  }

  const exp = await getExperiment(svc, membership.experiment_id);
  if (!exp) return NextResponse.json({ experiment: null });

  const today = kstToday();
  const monday = thisMondayKstDate();

  // 지역 전체: 실험 기간 내 기록의 (user, 날짜, 유형) 목록 — 집계 후 숫자만 반환
  const { data: allLogs } = await svc
    .from("experiment_care_logs")
    .select("user_id, cared_on, activity_type")
    .eq("experiment_id", exp.id);
  const logs = (allLogs ?? []) as {
    user_id: string; cared_on: string; activity_type: ExperimentActivityType;
  }[];

  const weekLogs = logs.filter((l) => l.cared_on >= monday);
  const loggedDays = new Set(logs.map((l) => l.cared_on));

  const myLogs = logs.filter((l) => l.user_id === user.id);
  const myWeekCount = myLogs.filter((l) => l.cared_on >= monday).length;
  const todayTypes = myLogs
    .filter((l) => l.cared_on === today)
    .map((l) => l.activity_type);

  const summary: ExperimentSummary = {
    experiment: {
      id: exp.id,
      publicAreaName: exp.public_area_name,
      startsAt: exp.starts_at,
      endsAt: exp.ends_at,
      status: exp.status,
      isOpenToday: isOpenToday(exp),
      daysLeft: dayDiff(today, exp.ends_at),
    },
    area: {
      weekLogCount: weekLogs.length,
      weekCarerCount: new Set(weekLogs.map((l) => l.user_id)).size,
      streakDays: computeStreakDays(loggedDays, today, exp.starts_at),
    },
    me: {
      todayTypes,
      weekLogCount: myWeekCount,
      totalLogCount: myLogs.length,
    },
  };

  await logExperimentEvent(svc, exp.id, "experiment_viewed");

  return NextResponse.json(summary);
}
