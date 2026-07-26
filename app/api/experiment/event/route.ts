// POST /api/experiment/event { experimentId, event }
// 클라이언트 발화 최소 계측 — 허용 이벤트만, 건수 전용(user_id·위치·메모 없음).
// invite_link_opened는 비로그인 상태에서도 발생하므로 인증을 요구하지 않는다.
// 대신 IP 레이트리밋 + 실험 존재 확인으로 쓰레기 행 삽입을 막는다.
// 나머지 이벤트(생성·참여·완료·실패·조회)는 각 서버 라우트에서 직접 기록.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isUuid, logExperimentEvent } from "@/lib/experiments-server";

const CLIENT_EVENTS = new Set(["invite_link_opened", "care_log_started", "care_log_failed"] as const);
type ClientEvent = typeof CLIENT_EVENTS extends Set<infer T> ? T : never;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`exp-event:${ip}`, { max: 20, windowMs: 60_000 })) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: { experimentId?: unknown; event?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const event = body.event as ClientEvent;
  if (!isUuid(body.experimentId) || !CLIENT_EVENTS.has(event)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: exp } = await svc
    .from("experiments")
    .select("id")
    .eq("id", body.experimentId)
    .maybeSingle();
  if (!exp) return NextResponse.json({ ok: false }, { status: 404 });

  await logExperimentEvent(svc, exp.id, event);
  return NextResponse.json({ ok: true });
}
