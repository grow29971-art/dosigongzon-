// 커뮤니티봇 exe → 올린 글·댓글의 반응 수치 (조회·좋아요·댓글 수, 이용자 댓글 샘플, 운영 댓글 뒤 반응).
// 쿼리: postIds=a,b&commentIds=x,y (각 50개까지). 인증: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>. 계약: docs/contracts.md 5절.
import { checkBotSecret, collectMetrics, serverReady } from "@/lib/community-bot";
import { createServiceClient } from "@/lib/supabase/service";

const UUID = /^[0-9a-f-]{36}$/i;
const parse = (v: string | null) => (v ?? "").split(",").map((s) => s.trim()).filter((s) => UUID.test(s));

export async function GET(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  const url = new URL(request.url);
  const result = await collectMetrics(createServiceClient(), { postIds: parse(url.searchParams.get("postIds")), commentIds: parse(url.searchParams.get("commentIds")) });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, ...result.value });
}
