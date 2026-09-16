// 커뮤니티봇 exe → 닉네임 풀·말투 목록 + 오늘 사용량.
// 닉네임은 exe 가 풀에서 랜덤으로 고르고(최근 것 피함), 말투는 서버가 닉네임 해시로 고정한다.
// 인증: Authorization: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>. 계약: docs/contracts.md 5절.
import { NICKNAME_POOL, VOICES, voiceFor } from "@/lib/community-personas";
import { botStats, checkBotSecret, serverReady } from "@/lib/community-bot";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  const stats = await botStats(createServiceClient());
  return Response.json({
    ok: true,
    nicknames: NICKNAME_POOL,
    voices: VOICES.map((v) => ({ id: v.id, voice: v.voice })),
    // 구버전 exe 호환: personas = 풀 전체를 페르소나 모양으로
    personas: NICKNAME_POOL.map((n) => ({ id: voiceFor(n).id, nickname: n, voice: voiceFor(n).voice, writesPosts: true })),
    stats,
  });
}
