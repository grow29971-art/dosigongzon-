// 마케팅봇 → 성장 지표(북극성 + 입력 지표). 개인정보 없이 숫자만 돌려준다. 설계: city-marketing/reports/2026-09-29_growth-design.md
// 쿼리: since=<ISO 날짜> (가입 코호트 시작, 기본 7일 전). 인증: Bearer <COMMUNITY_BOT_SECRET | CRON_SECRET>.
//  · wac        지난 7일 돌봄 기록(care_logs)을 1건+ 남긴 사람 수 — 북극성 지표. wacPrev 는 그 전 7일
//  · retention  지난주 기록한 사람 중 이번 주에도 기록한 비율
//  · cohort     since 이후 가입자 수, 그중 가입 7일 안 첫 기록(활성화) 수 — 출처(signup_source)별로도
//  · push       마케팅 푸시 동의 수, 푸시 구독 기기를 가진 사람 수
import { checkBotSecret, serverReady } from "@/lib/community-bot";
import { createServiceClient } from "@/lib/supabase/service";

const DAY = 864e5;

export async function GET(request: Request) {
  if (!checkBotSecret(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!serverReady()) return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  const raw = new URL(request.url).searchParams.get("since");
  const since = raw ? new Date(raw) : new Date(Date.now() - 7 * DAY);
  if (isNaN(since.getTime())) return Response.json({ ok: false, error: "since 형식 오류" }, { status: 400 });

  const db = createServiceClient();
  const now = Date.now();
  const iso = (t: number) => new Date(t).toISOString();

  // ponytail: 규모가 작아 행을 받아 JS로 센다(상한 10000행). 커지면 group by RPC로.
  const [logs, cohort, optIn, subs] = await Promise.all([
    db.from("care_logs").select("author_id, logged_at").gte("logged_at", iso(Math.min(now - 14 * DAY, since.getTime()))).limit(10000),
    db.from("profiles").select("id, created_at, signup_source").gte("created_at", since.toISOString()).limit(10000),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("marketing_push_enabled", true),
    db.from("push_subscriptions").select("user_id").limit(10000),
  ]);
  if (logs.error || cohort.error || optIn.error || subs.error) return Response.json({ ok: false, error: "조회 실패" }, { status: 500 });

  const rows = (logs.data ?? []) as { author_id: string | null; logged_at: string }[];
  const activeIn = (from: number, to: number) =>
    new Set(rows.filter((r) => r.author_id && +new Date(r.logged_at) >= from && +new Date(r.logged_at) < to).map((r) => r.author_id as string));
  const thisWeek = activeIn(now - 7 * DAY, now + DAY);
  const lastWeek = activeIn(now - 14 * DAY, now - 7 * DAY);
  const retained = [...lastWeek].filter((id) => thisWeek.has(id)).length;

  // 가입 코호트의 첫 기록 시각
  const firstLog = new Map<string, number>();
  for (const r of rows) {
    if (!r.author_id) continue;
    const t = +new Date(r.logged_at);
    if (!firstLog.has(r.author_id) || t < (firstLog.get(r.author_id) as number)) firstLog.set(r.author_id, t);
  }
  const bySource: Record<string, { signups: number; activated: number }> = {};
  let activated = 0;
  for (const p of (cohort.data ?? []) as { id: string; created_at: string; signup_source: string | null }[]) {
    const k = p.signup_source ?? "unknown";
    const b = (bySource[k] ??= { signups: 0, activated: 0 });
    b.signups++;
    const f = firstLog.get(p.id);
    if (f !== undefined && f - +new Date(p.created_at) <= 7 * DAY) (b.activated++, activated++);
  }

  const signups = cohort.data?.length ?? 0;
  return Response.json({
    ok: true,
    since: since.toISOString(),
    wac: thisWeek.size,
    wacPrev: lastWeek.size,
    retention: lastWeek.size ? Math.round((retained / lastWeek.size) * 1000) / 1000 : null,
    cohort: { signups, activated, activationRate: signups ? Math.round((activated / signups) * 1000) / 1000 : null, bySource },
    push: { optedIn: optIn.count ?? 0, subscribedUsers: new Set(((subs.data ?? []) as { user_id: string | null }[]).map((s) => s.user_id).filter(Boolean)).size },
  });
}
