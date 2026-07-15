// 주간 리텐션 리포트 — Vercel Cron 매주 월요일 아침 KST (일 23:30 UTC).
// admins 테이블 운영자에게 DM으로 핵심 리텐션 지표 + 전주 대비 증감(▲▼) 자동 발송.
// 목적: 리텐션·재미 기능이 실제로 활성/재방문을 끌어올리는지 매주 눈으로 확인.
// 푸시 안 함(소음 ↓) — admin-daily-digest와 동일한 자가 DM 패턴.
//
// 지표(최근 7일 vs 그 전 7일):
//   • 활성 유저(WAU)   ← 재방문 헤드라인 (daily_visits distinct)
//   • 신규 가입
//   • 돌봄 기록        ← 정체됐던 핵심 습관 루프
//   • 새 고양이
//   • 커뮤니티 글+댓글
//   • 누적 가입·고양이 (맥락)

import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 60;

function kstDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}
function mmdd(ms: number): string {
  const d = kstDate(ms); // YYYY-MM-DD
  return `${d.slice(5, 7)}/${d.slice(8, 10)}`;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }
  const supabase = createServiceClient();

  const now = Date.now();
  const DAY = 86_400_000;
  const wk1Start = new Date(now - 7 * DAY).toISOString(); // 최근 7일 시작
  const wk2Start = new Date(now - 14 * DAY).toISOString(); // 그 전 7일 시작
  const nowIso = new Date(now).toISOString();

  // [start, end) 기간 count (head-only)
  const range = (table: string, dateCol: string, start: string, end: string) =>
    supabase.from(table).select("*", { count: "exact", head: true }).gte(dateCol, start).lt(dateCol, end);

  const [
    usersCur, usersPrev,
    catsCur, catsPrev,
    careCur, carePrev,
    postsCur, postsPrev,
    commentsCur, commentsPrev,
    totalUsersRes, totalCatsRes,
    visitsRes,
  ] = await Promise.allSettled([
    range("profiles", "created_at", wk1Start, nowIso),
    range("profiles", "created_at", wk2Start, wk1Start),
    range("cats", "created_at", wk1Start, nowIso),
    range("cats", "created_at", wk2Start, wk1Start),
    range("care_logs", "logged_at", wk1Start, nowIso),
    range("care_logs", "logged_at", wk2Start, wk1Start),
    range("posts", "created_at", wk1Start, nowIso),
    range("posts", "created_at", wk2Start, wk1Start),
    range("post_comments", "created_at", wk1Start, nowIso),
    range("post_comments", "created_at", wk2Start, wk1Start),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("cats").select("*", { count: "exact", head: true }).eq("hidden", false),
    // 최근 14일 방문 (DAU ~10~20 → 14일 ≈ 200행 미만, 단일 fetch 안전)
    supabase.from("daily_visits").select("date, user_id").gte("date", kstDate(now - 14 * DAY)),
  ]);

  const pick = (r: PromiseSettledResult<{ count: number | null }>): number =>
    r.status === "fulfilled" ? (r.value.count ?? 0) : 0;

  // WAU (최근 7일 distinct) vs 전주
  const d7 = kstDate(now - 7 * DAY);
  const d14 = kstDate(now - 14 * DAY);
  const wauCur = new Set<string>();
  const wauPrev = new Set<string>();
  if (visitsRes.status === "fulfilled") {
    for (const v of (visitsRes.value.data ?? []) as { date: string; user_id: string }[]) {
      if (!v.user_id || !v.date) continue;
      if (v.date >= d7) wauCur.add(v.user_id);
      else if (v.date >= d14) wauPrev.add(v.user_id);
    }
  }

  const delta = (cur: number, prev: number): string => {
    const d = cur - prev;
    if (d > 0) return ` (▲${d})`;
    if (d < 0) return ` (▼${Math.abs(d)})`;
    return " (–)";
  };

  const uCur = pick(usersCur), uPrev = pick(usersPrev);
  const cCur = pick(catsCur), cPrev = pick(catsPrev);
  const careC = pick(careCur), careP = pick(carePrev);
  const commCur = pick(postsCur) + pick(commentsCur);
  const commPrev = pick(postsPrev) + pick(commentsPrev);
  const totalUsers = pick(totalUsersRes), totalCats = pick(totalCatsRes);

  const lines: string[] = [];
  lines.push(`📈 주간 리텐션 리포트 (${mmdd(now - 7 * DAY)}~${mmdd(now)})`);
  lines.push("( ) 안은 전주 대비");
  lines.push("");
  lines.push(`• 활성 유저(WAU): ${wauCur.size}명${delta(wauCur.size, wauPrev.size)}`);
  lines.push(`• 신규 가입: ${uCur}명${delta(uCur, uPrev)}`);
  lines.push(`• 돌봄 기록: ${careC}건${delta(careC, careP)}  ← 핵심 습관`);
  lines.push(`• 새 고양이: ${cCur}마리${delta(cCur, cPrev)}`);
  lines.push(`• 커뮤니티 글+댓글: ${commCur}건${delta(commCur, commPrev)}`);
  lines.push("");
  lines.push(`• 누적: 가입 ${totalUsers}명 · 고양이 ${totalCats}마리`);
  lines.push("");
  lines.push("매주 월요일 아침 자동. 활성화율·원샷이탈 등 정밀 진단은 로컬 스크립트로.");
  const body = lines.join("\n");

  // admins 조회 + 자가 DM (admin-daily-digest와 동일 패턴)
  const { data: admins, error: adminsErr } = await supabase.from("admins").select("user_id");
  if (adminsErr || !admins || admins.length === 0) {
    return Response.json({ ok: false, sent: 0, reason: "no admins" });
  }
  const adminIds = (admins as { user_id: string }[]).map((a) => a.user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", adminIds);
  const profileMap = new Map(
    ((profiles ?? []) as { id: string; nickname: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]),
  );

  const rows = adminIds.map((id) => {
    const prof = profileMap.get(id);
    return {
      sender_id: id,
      sender_name: prof?.nickname ?? "도시공존 운영",
      sender_avatar_url: prof?.avatar_url ?? null,
      receiver_id: id,
      receiver_name: prof?.nickname ?? "운영자",
      body,
    };
  });

  const { error: insertErr } = await supabase.from("direct_messages").insert(rows);
  if (insertErr) {
    return Response.json({ ok: false, sent: 0, error: insertErr.message });
  }

  return Response.json({
    ok: true,
    sent: rows.length,
    metrics: { wau: wauCur.size, wauPrev: wauPrev.size, newUsers: uCur, careLogs: careC, newCats: cCur, community: commCur, totalUsers, totalCats },
  });
}

// Vercel Cron은 GET으로 호출 — POST와 동일 처리 (CRON_SECRET 검사 동일)
export const GET = POST;
