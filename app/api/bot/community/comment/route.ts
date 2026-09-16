// 커뮤니티봇 exe → 이용자 글에 운영 페르소나 첫 댓글 + 글쓴이 푸시. 대상 검증·하루 상한은 lib/community-bot.
// 본문: { nickname, postId, body } (구: personaId). 인증: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>. 계약: docs/contracts.md 5절.
import { checkBotSecret, insertPersonaComment, resolvePersona, serverReady } from "@/lib/community-bot";

export async function POST(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  let body: { nickname?: string; personaId?: string; postId?: string; body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "JSON 본문이 필요해요" }, { status: 400 });
  }
  const persona = resolvePersona(body);
  if (!persona) return Response.json({ ok: false, error: "닉네임이 없거나 형식이 맞지 않아요 (한글·영문·숫자 2~12자)" }, { status: 400 });
  if (typeof body.postId !== "string" || typeof body.body !== "string") {
    return Response.json({ ok: false, error: "postId·body 가 필요해요" }, { status: 400 });
  }
  const result = await insertPersonaComment({ persona, postId: body.postId, body: body.body });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, ...result.value, nickname: persona.nickname, url: `/community/${body.postId}` });
}
