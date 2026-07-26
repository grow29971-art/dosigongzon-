// POST /api/experiment/invite { experimentId }
// 초대 링크 생성 — 토큰 원문은 DB에 저장하지 않고 sha256 해시만 저장, 원문은 이 응답에서 1회만 반환.
// 남용 방어: 유저당 분당 5회 레이트리밋 + 미사용 활성 초대 30개 상한.

import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import {
  getExperiment, isMember, isSuspendedUser, isOpenToday, isUuid, logExperimentEvent,
} from "@/lib/experiments-server";
import { inviteCopy } from "@/lib/experiments-repo";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_INVITES = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  if (!rateLimit(`exp-invite:${user.id}`, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let body: { experimentId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!isUuid(body.experimentId)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const svc = createServiceClient();
  const exp = await getExperiment(svc, body.experimentId);
  if (!exp) return NextResponse.json({ error: "실험을 찾을 수 없어요." }, { status: 404 });
  if (!isOpenToday(exp)) {
    return NextResponse.json({ error: "지금은 초대할 수 없는 실험이에요." }, { status: 400 });
  }
  if (!(await isMember(svc, exp.id, user.id))) {
    return NextResponse.json({ error: "실험 참여자만 초대할 수 있어요." }, { status: 403 });
  }
  if (await isSuspendedUser(svc, user.id)) {
    return NextResponse.json({ error: "이용이 제한된 계정이에요." }, { status: 403 });
  }

  // 미사용 활성 초대 상한 — 링크 대량 생성 남용 방지
  const { count } = await svc
    .from("experiment_invites")
    .select("id", { count: "exact", head: true })
    .eq("inviter_id", user.id)
    .eq("experiment_id", exp.id)
    .is("accepted_by", null)
    .gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_ACTIVE_INVITES) {
    return NextResponse.json(
      { error: "만들어 둔 초대 링크가 너무 많아요. 기존 링크를 사용해 주세요." },
      { status: 429 },
    );
  }

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  const { error } = await svc.from("experiment_invites").insert({
    experiment_id: exp.id,
    inviter_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) {
    return NextResponse.json({ error: "초대 링크 생성에 실패했어요." }, { status: 500 });
  }

  await logExperimentEvent(svc, exp.id, "invite_link_created");

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    ok: true,
    url: `${origin}/experiment/join/${token}`,
    copy: inviteCopy(exp.public_area_name),
    expiresAt,
  });
}
