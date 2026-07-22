// 00시대 일일 크론 통합 디스패처 (2026-07-18)
// 배경: Vercel Hobby 크론은 "하루 1회 + 정시 보장 없음 + 배달 베스트에포트(누락 가능)"라,
//       00시대에 몰린 크론 중 일부(특히 admin-daily-digest)가 반복 결행함(개발일지_20260718 §5).
// 해결: Vercel이 보장할 호출을 3개→1개(이 디스패처)로 줄이고, 세 잡의 실행을 코드로 보장.
// 동작: CRON_SECRET 인증 후 news-crawl·admin-daily-digest·payment-reconcile를 병렬 호출.
//       각 잡은 자기 라우트에서 독립 serverless 실행되므로 하나가 실패해도 나머지에 영향 없음.
//       서브 호출도 미들웨어 하트비트(proxy.ts)로 cron_runs에 그대로 기록돼 모니터링은 유지된다.
// 롤백: vercel.json에서 daily-dispatch를 빼고 news-crawl(0 0)·admin-daily-digest(10 0)·
//       payment-reconcile(20 0) 3개를 되살리면 됨. 이 파일은 삭제해도 무방.

export const maxDuration = 60;

// 2026-07-22 팬아웃 고장 수리: 스케줄 호출의 request.url origin은 배포 URL
// (*.vercel.app, Deployment Protection에 막힘)이라 서브 fetch가 무음 실패했다
// (7/19~22 디스패처만 발화, 서브잡 하트비트 0건 — 리텐션 회의 실측).
// 수동 테스트는 dosigongzon.com으로 호출해서 통과 → 3일 무증상.
// 해결: origin을 프로덕션 도메인으로 고정 + 실패를 console.error로 가시화.
const DISPATCH_ORIGIN = process.env.CRON_DISPATCH_ORIGIN || "https://dosigongzon.com";

const DAILY_JOBS = ["news-crawl", "admin-daily-digest", "payment-reconcile"] as const;

// 요일 조건부 잡 (2026-07-22 리텐션 회의: 유령 3종 부활 — 스케줄 슬롯 추가 없이 편입)
// 디스패처는 00:00 UTC = 09:00 KST 발화. 원래 의도 시각과 다르지만 배달 보장이 우선.
const WEEKDAY_JOBS: Record<number, string[]> = {
  3: ["engagement-push"], // 수요일(KST)
  6: ["onboarding-nudge"], // 토요일(KST)
  0: ["weekly-postcard-push"], // 일요일(KST)
};

function kstWeekday(): number {
  return new Date(Date.now() + 9 * 3600 * 1000).getUTCDay();
}

async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = [...DAILY_JOBS, ...(WEEKDAY_JOBS[kstWeekday()] ?? [])];

  const settled = await Promise.allSettled(
    jobs.map((job) =>
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
      : { job: jobs[i], status: 0, ok: false, error: String(s.reason) },
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    // Vercel 함수 로그 + Sentry에서 보이도록 — 무음 실패 재발 방지
    console.error("[daily-dispatch] 서브잡 실패:", JSON.stringify(failed));
  }

  return Response.json({ dispatchedAt: new Date().toISOString(), origin: DISPATCH_ORIGIN, results });
}

export async function POST(request: Request) {
  return handle(request);
}

// Vercel Cron은 GET으로 호출 → 동일 처리
export const GET = POST;
