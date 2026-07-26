// POST /api/experiment/join { token }
// 초대 수락 — 토큰은 1회용. 원문을 sha256 해시로 조회하고, accepted_by가 비어 있을 때만
// 원자적으로 선점(update ... is null)해 동시 사용 레이스를 막는다.
// 중복 참여는 experiment_members pk가 최종 방어.

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getExperiment, isSuspendedUser, logExperimentEvent } from "@/lib/experiments-server";
import { kstToday } from "@/lib/kst";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`exp-join:${ip}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "invalid", message: "유효하지 않은 초대예요." }, { status: 404 });
  }

  const svc = createServiceClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: invite } = await svc
    .from("experiment_invites")
    .select("id, experiment_id, inviter_id, expires_at, accepted_by")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "invalid", message: "유효하지 않은 초대예요." }, { status: 404 });
  }

  const exp = await getExperiment(svc, invite.experiment_id);
  if (!exp) {
    return NextResponse.json({ error: "invalid", message: "유효하지 않은 초대예요." }, { status: 404 });
  }

  // 이미 참여 중이면 토큰 상태와 무관하게 성공 처리 (초대 중복 집계 방지 — 초대는 소진하지 않음)
  const { data: existing } = await svc
    .from("experiment_members")
    .select("user_id")
    .eq("experiment_id", exp.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      ok: true, already: true, experimentId: exp.id, areaName: exp.public_area_name,
    });
  }

  if (invite.inviter_id === user.id) {
    return NextResponse.json(
      { error: "self", message: "본인이 만든 초대 링크예요. 다른 분께 공유해 주세요." },
      { status: 400 },
    );
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired", message: "만료된 초대예요." }, { status: 410 });
  }
  if (invite.accepted_by) {
    return NextResponse.json(
      { error: "used", message: "이미 사용된 초대 링크예요. 초대한 분께 새 링크를 요청해 주세요." },
      { status: 409 },
    );
  }
  // 종료된 실험은 참여 불가 (시작 전 참여는 허용 — 시작일에 함께 출발)
  const today = kstToday();
  if (exp.status !== "active" || today > exp.ends_at) {
    return NextResponse.json({ error: "ended", message: "이미 마무리된 실험이에요." }, { status: 410 });
  }
  if (await isSuspendedUser(svc, user.id)) {
    return NextResponse.json({ error: "suspended", message: "이용이 제한된 계정이에요." }, { status: 403 });
  }

  // 1회용 토큰 원자적 선점 — accepted_by가 아직 null인 경우에만 성공
  const { data: claimed } = await svc
    .from("experiment_invites")
    .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("accepted_by", null)
    .select("id");
  if (!claimed || claimed.length === 0) {
    return NextResponse.json(
      { error: "used", message: "이미 사용된 초대 링크예요. 초대한 분께 새 링크를 요청해 주세요." },
      { status: 409 },
    );
  }

  const { error: memberError } = await svc.from("experiment_members").insert({
    experiment_id: exp.id,
    user_id: user.id,
    invited_by: invite.inviter_id,
  });
  // pk 충돌(동시 참여 레이스)은 이미 참여로 간주
  if (memberError && memberError.code !== "23505") {
    return NextResponse.json({ error: "failed", message: "참여 처리에 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }

  await logExperimentEvent(svc, exp.id, "experiment_joined");

  return NextResponse.json({
    ok: true, already: false, experimentId: exp.id, areaName: exp.public_area_name,
  });
}
