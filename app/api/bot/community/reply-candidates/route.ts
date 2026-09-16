// 커뮤니티봇 exe → 운영 글에 달린 이용자 댓글 중 아직 운영 답글이 없는 것 (최근 14일).
// 답글은 반드시 그 글의 작성자 닉네임(postNickname)으로 — 서버가 reply 에서 강제한다.
// 인증: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>. 계약: docs/contracts.md 5절.
import { checkBotSecret, listReplyCandidates, serverReady } from "@/lib/community-bot";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  const url = new URL(request.url);
  const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") ?? "10") || 10));
  const result = await listReplyCandidates(createServiceClient(), { limit });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, candidates: result.value });
}
