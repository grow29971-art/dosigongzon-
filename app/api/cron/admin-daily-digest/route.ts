// 운영자 일일 다이제스트 — Vercel Cron 매일 09:10 KST (00:10 UTC)
// (원래 08:00 KST(23:00 UTC)였으나 해당 슬롯 스케줄 호출이 안 와서
//  실행이 검증된 00:00 UTC 직후로 이동 — 2026-07-13, cron_runs 하트비트로 추적 중)
// admins 테이블의 모든 운영자에게 DM으로 어제 활동 요약 자동 발송.
// 출시 후 매일 모니터링 부담 ↓ — 자기 자신에게 DM (자가 발송 패턴).
//
// 발송 톤:
//   📊 어제 운영 요약 (YYYY-MM-DD)
//   • 신규 가입 N명 (총 X명)
//   • 신규 등록 M마리 (총 Y마리)
//   • 신규 돌봄·댓글 K건
//   • 미처리 신고 P · 문의 Q
//   • 7일 로그인 실패 R건
//
// 운영자가 도시공존 앱·웹 열면 인박스에 어제 요약이 쌓여 있음. 푸시 발송 안 함(소음 ↓).

import { createServiceClient } from "@/lib/supabase/service";
import { toKstDate } from "@/lib/kst";

export const maxDuration = 60;

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

  // KST 어제 00:00 ~ 오늘 00:00
  const now = new Date();
  const todayKstStart = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  todayKstStart.setHours(0, 0, 0, 0);
  const todayUtcMs = todayKstStart.getTime() - 9 * 60 * 60 * 1000;
  const yesterdayUtcMs = todayUtcMs - 24 * 60 * 60 * 1000;
  const yesterdayStart = new Date(yesterdayUtcMs).toISOString();
  const todayStart = new Date(todayUtcMs).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 어제 활동 집계 (Promise.allSettled — 한 쿼리 실패해도 전체 진행)
  const [
    newUsersRes,
    newCatsRes,
    newCommentsRes,
    newCareLogsRes,
    totalUsersRes,
    totalCatsRes,
    pendingReportsRes,
    pendingInquiriesRes,
    authErrorsRes,
  ] = await Promise.allSettled([
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .gte("created_at", yesterdayStart).lt("created_at", todayStart),
    supabase.from("cats").select("*", { count: "exact", head: true })
      .gte("created_at", yesterdayStart).lt("created_at", todayStart),
    supabase.from("cat_comments").select("*", { count: "exact", head: true })
      .gte("created_at", yesterdayStart).lt("created_at", todayStart),
    supabase.from("care_logs").select("*", { count: "exact", head: true })
      .gte("logged_at", yesterdayStart).lt("logged_at", todayStart),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("cats").select("*", { count: "exact", head: true }).eq("hidden", false),
    supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("auth_error_logs").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
  ]);

  const pick = (r: PromiseSettledResult<{ count: number | null }>): number =>
    r.status === "fulfilled" ? (r.value.count ?? 0) : 0;

  const newUsers = pick(newUsersRes);
  const newCats = pick(newCatsRes);
  const newComments = pick(newCommentsRes);
  const newCareLogs = pick(newCareLogsRes);
  const totalUsers = pick(totalUsersRes);
  const totalCats = pick(totalCatsRes);
  const pendingReports = pick(pendingReportsRes);
  const pendingInquiries = pick(pendingInquiriesRes);
  const authErrors7d = pick(authErrorsRes);

  // 출시 D-day
  const LAUNCH_DATE = new Date("2026-06-01T00:00:00+09:00");
  const daysToLaunch = Math.ceil((LAUNCH_DATE.getTime() - Date.now()) / 86400000);

  const yesterdayLabel = toKstDate(new Date(yesterdayUtcMs));

  // 다이제스트 메시지 빌더 — 인박스에서 바로 읽기 좋은 톤
  const lines: string[] = [];
  lines.push(`📊 어제(${yesterdayLabel}) 운영 요약`);
  lines.push("");
  if (daysToLaunch > 0) {
    lines.push(`🚀 정식 출시 D-${daysToLaunch}`);
  } else if (daysToLaunch === 0) {
    lines.push(`🎉 정식 출시 D-Day`);
  } else {
    lines.push(`📅 출시 +${Math.abs(daysToLaunch)}일째`);
  }
  lines.push("");
  lines.push(`• 신규 가입: ${newUsers}명 (총 ${totalUsers}명)`);
  lines.push(`• 신규 등록: ${newCats}마리 (총 ${totalCats}마리)`);
  lines.push(`• 신규 돌봄·댓글: ${newCareLogs + newComments}건`);
  if (pendingReports > 0 || pendingInquiries > 0) {
    lines.push(`• ⚠ 미처리: 신고 ${pendingReports}건 · 문의 ${pendingInquiries}건`);
  }
  if (authErrors7d > 50) {
    lines.push(`• 🚨 7일 로그인 실패 ${authErrors7d}건 (이상치 가능)`);
  }
  lines.push("");
  lines.push("자세히 → /admin (이 메시지는 매일 아침 자동 발송)");
  const body = lines.join("\n");

  // admin 사용자 조회 (admins 테이블)
  const { data: admins, error: adminsErr } = await supabase
    .from("admins")
    .select("user_id");
  if (adminsErr || !admins || admins.length === 0) {
    return Response.json({ ok: false, sent: 0, reason: "no admins" });
  }
  const adminIds = (admins as { user_id: string }[]).map((a) => a.user_id);

  // 각 admin의 프로필 (sender 스냅샷) — 자가 발송이라 본인 닉네임·아바타 사용
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", adminIds);
  const profileMap = new Map(
    ((profiles ?? []) as { id: string; nickname: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]),
  );

  // DM 자가 발송 (sender = receiver = admin)
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
    summary: { newUsers, newCats, newCareLogs, newComments, pendingReports, pendingInquiries },
  });
}

// Vercel Cron은 GET으로 호출 — POST와 동일 처리 (CRON_SECRET 검사 동일)
export const GET = POST;
