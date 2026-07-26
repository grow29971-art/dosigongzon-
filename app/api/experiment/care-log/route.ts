// POST /api/experiment/care-log { experimentId, activityType }
// '오늘 돌봄 완료' 기록 — 날짜는 서버에서 KST 오늘로 고정 (클라이언트 날짜 조작 불가).
// 중복(연타·재제출)은 DB unique(experiment_id, user_id, cared_on, activity_type)로 멱등 처리.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import {
  getExperiment, isMember, isSuspendedUser, isOpenToday, isUuid, logExperimentEvent,
} from "@/lib/experiments-server";
import { EXPERIMENT_ACTIVITY_TYPES, type ExperimentActivityType } from "@/lib/experiments-repo";
import { kstToday } from "@/lib/kst";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  if (!rateLimit(`exp-care:${user.id}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let body: { experimentId?: unknown; activityType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const activityType = body.activityType as ExperimentActivityType;
  if (!isUuid(body.experimentId) || !EXPERIMENT_ACTIVITY_TYPES.includes(activityType)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const svc = createServiceClient();
  const exp = await getExperiment(svc, body.experimentId);
  if (!exp) return NextResponse.json({ error: "실험을 찾을 수 없어요." }, { status: 404 });

  if (!(await isMember(svc, exp.id, user.id))) {
    return NextResponse.json({ error: "실험 참여자만 기록할 수 있어요." }, { status: 403 });
  }
  if (await isSuspendedUser(svc, user.id)) {
    return NextResponse.json({ error: "이용이 제한된 계정이에요." }, { status: 403 });
  }
  if (!isOpenToday(exp)) {
    await logExperimentEvent(svc, exp.id, "care_log_failed");
    const today = kstToday();
    const message =
      today < exp.starts_at
        ? `실험은 ${exp.starts_at}부터 시작돼요. 조금만 기다려 주세요.`
        : "실험 기간이 마무리됐어요. 함께해 주셔서 고마워요.";
    return NextResponse.json({ error: "not_open", message }, { status: 400 });
  }

  const today = kstToday();
  const { data: inserted, error } = await svc
    .from("experiment_care_logs")
    .upsert(
      { experiment_id: exp.id, user_id: user.id, activity_type: activityType, cared_on: today },
      { onConflict: "experiment_id,user_id,cared_on,activity_type", ignoreDuplicates: true },
    )
    .select("id");

  if (error) {
    await logExperimentEvent(svc, exp.id, "care_log_failed");
    return NextResponse.json(
      { error: "failed", message: "저장에 실패했어요. 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  const already = !inserted || inserted.length === 0;
  if (!already) await logExperimentEvent(svc, exp.id, "care_log_completed");

  // 오늘 기록한 유형 목록 반환 — 버튼 상태 동기화용
  const { data: todayRows } = await svc
    .from("experiment_care_logs")
    .select("activity_type")
    .eq("experiment_id", exp.id)
    .eq("user_id", user.id)
    .eq("cared_on", today);

  return NextResponse.json({
    ok: true,
    already,
    todayTypes: (todayRows ?? []).map((r) => r.activity_type),
  });
}
