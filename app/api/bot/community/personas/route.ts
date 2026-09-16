// 커뮤니티봇 exe → 페르소나 목록 (닉네임·말투·글 작성 여부) + 오늘 사용량.
// 인증: Authorization: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>. 계약: docs/contracts.md 5절.
import { PERSONAS } from "@/lib/community-personas";
import { botStats, checkBotSecret, serverReady } from "@/lib/community-bot";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  const stats = await botStats(createServiceClient());
  return Response.json({
    ok: true,
    personas: PERSONAS.map((p) => ({ id: p.id, nickname: p.nickname, voice: p.voice, writesPosts: p.writesPosts })),
    stats,
  });
}
