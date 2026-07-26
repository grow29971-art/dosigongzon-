// 초대 랜딩 — /experiment/join/[token]
// 서버에서 토큰(sha256 해시)으로 초대 상태를 판정해 클라이언트에 넘긴다.
// OG 메타데이터(카톡 공유 미리보기)는 공개 지역명·초대 문구만 사용 — 좌표·개인정보 없음.
// invite_link_opened 계측은 클라이언트에서만 발화 (OG 크롤러 집계 오염 방지).

import { createHash } from "crypto";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { inviteCopy } from "@/lib/experiments-repo";
import { kstToday } from "@/lib/kst";
import JoinClient, { type InviteState } from "./JoinClient";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

async function resolveInvite(token: string): Promise<InviteState> {
  if (!TOKEN_RE.test(token)) return { status: "invalid" };

  const svc = createServiceClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: invite } = await svc
    .from("experiment_invites")
    .select("experiment_id, expires_at, accepted_by")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!invite) return { status: "invalid" };

  const { data: exp } = await svc
    .from("experiments")
    .select("id, public_area_name, starts_at, ends_at, status")
    .eq("id", invite.experiment_id)
    .maybeSingle();
  if (!exp) return { status: "invalid" };

  const base = {
    experimentId: exp.id as string,
    areaName: exp.public_area_name as string,
    startsAt: exp.starts_at as string,
    endsAt: exp.ends_at as string,
  };
  if (exp.status !== "active" || kstToday() > exp.ends_at) return { status: "ended", ...base };
  if (new Date(invite.expires_at).getTime() < Date.now()) return { status: "expired", ...base };
  if (invite.accepted_by) return { status: "used", ...base };
  return { status: "valid", ...base };
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
): Promise<Metadata> {
  const { token } = await params;
  const state = await resolveInvite(token);
  if (state.status === "invalid" || !("areaName" in state)) {
    return { title: "도시공존 — 돌봄 기록 실험 초대" };
  }
  const title = `${state.areaName} 길고양이 돌봄 기록 2주 실험에 초대해요`;
  const description = inviteCopy(state.areaName);
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function ExperimentJoinPage(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const state = await resolveInvite(token);
  return <JoinClient token={token} state={state} />;
}
