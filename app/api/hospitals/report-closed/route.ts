import { createServiceClient } from "@/lib/supabase/service";

// 유저별 신고 빈도 제한 (인메모리, 1시간에 5회)
const reportLog = new Map<string, number[]>();
const REPORT_LIMIT = 5;
const REPORT_WINDOW = 60 * 60 * 1000; // 1시간

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }

  const supabase = createServiceClient();

  // 로그인 확인
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return Response.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return Response.json({ error: "인증 실패" }, { status: 401 });
  }

  // 정지 유저 차단
  const { data: profile } = await supabase
    .from("profiles")
    .select("suspended")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.suspended) {
    return Response.json({ error: "정지된 계정입니다" }, { status: 403 });
  }

  // Rate limit: 유저당 1시간 5회
  const now = Date.now();
  const userLog = (reportLog.get(user.id) ?? []).filter((t) => now - t < REPORT_WINDOW);
  if (userLog.length >= REPORT_LIMIT) {
    return Response.json({ error: "신고 횟수 초과 (1시간 5회)" }, { status: 429 });
  }

  let body: { hospitalId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const { hospitalId } = body;
  if (!hospitalId || typeof hospitalId !== "string") {
    return Response.json({ error: "병원 ID 필요" }, { status: 400 });
  }

  // 병원 존재 + 이미 숨김 상태인지 확인
  const { data: hospital } = await supabase
    .from("rescue_hospitals")
    .select("id, hidden")
    .eq("id", hospitalId)
    .maybeSingle();

  if (!hospital) {
    return Response.json({ error: "병원을 찾을 수 없어요" }, { status: 404 });
  }
  if (hospital.hidden) {
    return Response.json({ error: "이미 신고된 병원이에요" }, { status: 409 });
  }

  // 신고를 reports 테이블에 누적 — 1유저가 즉시 hidden 처리하던 abuse vector 차단.
  // 동일 hospitalId에 3명 이상 신고가 누적되면 admin이 검토 후 처리하는 큐로 운영.
  const { error: reportInsertErr } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reporter_email: null,
    reporter_name: "익명 신고자",
    target_type: "hospital_closed",
    target_id: hospitalId,
    target_snapshot: null,
    reason: "closed",
    description: "병원 폐업 신고",
  });
  if (reportInsertErr) {
    // 동일 유저 중복 신고 등 UNIQUE 위반 — 부드럽게 처리
    if ((reportInsertErr as { code?: string }).code === "23505") {
      return Response.json({ error: "이미 신고하셨어요" }, { status: 409 });
    }
    return Response.json({ error: "처리 실패" }, { status: 500 });
  }

  // 누적 신고 수 확인 — 3건 이상이면 자동 숨김
  const { count } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("target_type", "hospital_closed")
    .eq("target_id", hospitalId)
    .neq("status", "dismissed");

  const HIDE_THRESHOLD = 3;
  if ((count ?? 0) >= HIDE_THRESHOLD) {
    await supabase.from("rescue_hospitals").update({ hidden: true }).eq("id", hospitalId);
  }

  // 성공 → in-memory rate-limit 카운터 기록
  userLog.push(now);
  reportLog.set(user.id, userLog);

  return Response.json({
    ok: true,
    message:
      (count ?? 0) >= HIDE_THRESHOLD
        ? "신고가 접수돼 자동으로 숨김 처리됐어요"
        : `신고가 접수됐어요 (${count}/${HIDE_THRESHOLD}건 누적, ${HIDE_THRESHOLD}건부터 자동 숨김)`,
  });
}
