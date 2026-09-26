// 마케팅봇 → 기간 내 가입 수를 유입 출처(profiles.signup_source)별로. 개인정보 없이 숫자만 돌려준다.
// 쿼리: since=<ISO 날짜> (기본 7일 전). 인증: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>. 계약: docs/contracts.md 6절.
import { checkBotSecret, serverReady } from "@/lib/community-bot";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  const raw = new URL(request.url).searchParams.get("since");
  const since = raw ? new Date(raw) : new Date(Date.now() - 7 * 864e5);
  if (isNaN(since.getTime())) return Response.json({ ok: false, error: "since 형식 오류" }, { status: 400 });

  // ponytail: 가입 수가 적어 행을 받아 JS로 센다. 기간이 길어져 수만 행이 되면 group by RPC로.
  const { data, error } = await createServiceClient()
    .from("profiles")
    .select("signup_source")
    .gte("created_at", since.toISOString())
    .limit(10000);
  if (error) return Response.json({ ok: false, error: "조회 실패" }, { status: 500 });

  const bySource: Record<string, number> = {};
  for (const r of data) {
    const k = r.signup_source ?? "unknown";
    bySource[k] = (bySource[k] ?? 0) + 1;
  }
  return Response.json({ ok: true, since: since.toISOString(), total: data.length, bySource });
}
