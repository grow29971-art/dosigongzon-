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

const JOBS = ["news-crawl", "admin-daily-digest", "payment-reconcile"] as const;

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
