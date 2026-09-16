// 커뮤니티봇 exe → 운영 글의 이용자 댓글에 답글. 닉네임은 요청값과 상관없이 그 글의 작성자 닉네임으로 고정.
// 본문: { postId, parentId, body }. 인증: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>. 계약: docs/contracts.md 5절.
import { checkBotSecret, insertPersonaReply, serverReady } from "@/lib/community-bot";

export async function POST(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  let body: { postId?: string; parentId?: string; body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "JSON 본문이 필요해요" }, { status: 400 });
  }
  if (typeof body.postId !== "string" || typeof body.parentId !== "string" || typeof body.body !== "string") {
    return Response.json({ ok: false, error: "postId·parentId·body 가 필요해요" }, { status: 400 });
  }
  const result = await insertPersonaReply({ postId: body.postId, parentId: body.parentId, body: body.body });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, ...result.value, url: `/community/${body.postId}` });
}
