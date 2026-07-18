// 일요일 23시대 주간 크론 통합 디스패처 (2026-07-18)
// 배경: daily-dispatch(§개발일지_20260718 §5)와 동일 — Hobby 크론 베스트에포트 결행이
//       weekly에서도 확인됨(engagement-push·onboarding-nudge 계측 후 발화 0건).
//       특히 weekly-battle-payout 결행은 유저 지급 누락이라 신뢰 직결.
// 동작: CRON_SECRET 인증 후 일요일 23시대 3잡을 병렬 호출. 하나가 실패해도 격리.
//       서브 호출도 미들웨어 하트비트(proxy.ts)로 cron_runs에 기록돼 모니터링 유지.
// 롤백: vercel.json에서 weekly-dispatch를 빼고 weekly-battle-payout(0 23 * * 0)·
//       weekly-digest(0 23 * * 0)·retention-report(30 23 * * 0)를 되살리면 됨.

export const maxDuration = 60;

const JOBS = ["weekly-battle-payout", "retention-report", "weekly-digest"] as const;

async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  const settled = await Promise.allSettled(
    JOBS.map((job) =>
      fetch(`${origin}/api/cron/${job}`, {
        method: "POST",
        headers: { authorization: `Bearer ${cronSecret}` },
      }).then((r) => ({ job, status: r.status, ok: r.ok })),
    ),
  );

  const results = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { job: JOBS[i], status: 0, ok: false, error: String(s.reason) },
  );

  return Response.json({ dispatchedAt: new Date().toISOString(), results });
}

export async function POST(request: Request) {
  return handle(request);
}

// Vercel Cron은 GET으로 호출 → 동일 처리
export const GET = POST;
