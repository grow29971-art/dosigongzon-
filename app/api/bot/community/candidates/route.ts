// 커뮤니티봇 exe → 운영 댓글을 달 만한 유저 글 후보.
// 자유게시판·숨김 아님·봇 글 아님·아직 운영 댓글 없음·올라온 지 minAgeHours(기본 1시간)~7일.
// 인증: Authorization: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>. 계약: docs/contracts.md 5절.
import { checkBotSecret, listCommentCandidates, serverReady } from "@/lib/community-bot";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  const url = new URL(request.url);
  const minAgeHours = Math.min(48, Math.max(0, Number(url.searchParams.get("minAgeHours") ?? "1") || 0));
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? "10") || 10));
  // own=1: 봇 글 중 다른 닉네임 봇 댓글이 2개 미만인 것 (사장님 2026-09-16: 내 글에도 다른 닉으로 댓글)
  const own = url.searchParams.get("own") === "1";
  const result = await listCommentCandidates(createServiceClient(), { minAgeMs: minAgeHours * 3600 * 1000, limit, own });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, candidates: result.value });
}
