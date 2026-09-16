// 커뮤니티봇 exe → 운영 페르소나 댓글 등록 + 글쓴이 푸시. 대상 검증·하루 상한은 lib/community-bot.
// 본문: { personaId, postId, body }. 인증: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>. 계약: docs/contracts.md 5절.
import { checkBotSecret, findPersona, insertPersonaComment, serverReady } from "@/lib/community-bot";

export async function POST(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  let body: { personaId?: string; postId?: string; body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "JSON 본문이 필요해요" }, { status: 400 });
  }
  const persona = findPersona(body.personaId);
  if (!persona) return Response.json({ ok: false, error: "알 수 없는 페르소나" }, { status: 400 });
  if (typeof body.postId !== "string" || typeof body.body !== "string") {
    return Response.json({ ok: false, error: "postId·body 가 필요해요" }, { status: 400 });
  }
  const result = await insertPersonaComment({ persona, postId: body.postId, body: body.body });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, ...result.value, url: `/community/${body.postId}` });
}
