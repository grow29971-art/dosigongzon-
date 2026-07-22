// 일요일 23시대 주간 크론 통합 디스패처 (2026-07-18)
// 배경: daily-dispatch(§개발일지_20260718 §5)와 동일 — Hobby 크론 베스트에포트 결행이
//       weekly에서도 확인됨(engagement-push·onboarding-nudge 계측 후 발화 0건).
// 동작: CRON_SECRET 인증 후 일요일 23시대 잡을 병렬 호출. 하나가 실패해도 격리.
//       서브 호출도 미들웨어 하트비트(proxy.ts)로 cron_runs에 기록돼 모니터링 유지.
// 롤백: vercel.json에서 weekly-dispatch를 빼고 weekly-digest(0 23 * * 0)·
//       retention-report(30 23 * * 0)를 되살리면 됨.
// 2026-07-20: weekly-battle-payout은 카드배틀 삭제와 함께 제거.

export const maxDuration = 60;

// 2026-07-22 팬아웃 고장 수리 — daily-dispatch와 동일 (배포 URL origin이 프로텍션에 막혀
// 서브 fetch 무음 실패). 프로덕션 도메인 고정 + 실패 가시화.
const DISPATCH_ORIGIN = process.env.CRON_DISPATCH_ORIGIN || "https://dosigongzon.com";

const JOBS = ["retention-report", "weekly-digest"] as const;

async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settled = await Promise.allSettled(
    JOBS.map((job) =>
      fetch(`${DISPATCH_ORIGIN}/api/cron/${job}`, {
        method: "POST",
        headers: { authorization: `Bearer ${cronSecret}` },
        cache: "no-store",
      }).then((r) => ({ job, status: r.status, ok: r.ok })),
    ),
  );

  const results = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { job: JOBS[i], status: 0, ok: false, error: String(s.reason) },
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error("[weekly-dispatch] 서브잡 실패:", JSON.stringify(failed));
  }

  return Response.json({ dispatchedAt: new Date().toISOString(), origin: DISPATCH_ORIGIN, results });
}

export async function POST(request: Request) {
  return handle(request);
}

// Vercel Cron은 GET으로 호출 → 동일 처리
export const GET = POST;
