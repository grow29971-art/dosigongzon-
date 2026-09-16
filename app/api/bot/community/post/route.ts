// 커뮤니티봇 exe → 운영 페르소나 글 등록. 자유게시판 고정, 운영 배지 강제, 하루 상한은 lib/community-bot.
// 본문: { nickname, title, content } (구: personaId). 인증: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>. 계약: docs/contracts.md 5절.
import { checkBotSecret, insertPersonaPost, resolvePersona, serverReady } from "@/lib/community-bot";

export async function POST(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  let body: { nickname?: string; personaId?: string; title?: string; content?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "JSON 본문이 필요해요" }, { status: 400 });
  }
  const persona = resolvePersona(body);
  if (!persona) return Response.json({ ok: false, error: "닉네임이 없거나 형식이 맞지 않아요 (한글·영문·숫자 2~12자)" }, { status: 400 });
  if (typeof body.title !== "string" || typeof body.content !== "string") {
    return Response.json({ ok: false, error: "title·content 가 필요해요" }, { status: 400 });
  }
  const result = await insertPersonaPost({ persona, title: body.title, content: body.content });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, postId: result.value.postId, nickname: persona.nickname, url: `/community/${result.value.postId}` });
}
