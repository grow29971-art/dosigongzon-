// 운영자 → 전체 사용자 일괄 쪽지 발송 (admin 전용)
// 145명 시점 활성화 액션 — 환영·재참여 등 진심 전달용.
// service_role로 모든 profiles fetch + DM 일괄 insert.
// DM 도배 trigger는 admin sender 면제 적용됨 (supabase_admin_rate_limit_exempt_migration.sql).
//
// 발송 대상 옵션:
//   - all: 전체 가입자 (자기 자신 제외)
//   - founding: founding_member 타이틀 보유자
//   - no_cat: 첫 등록 미완료 (catCount = 0)
//   - dormant: 8~30일 미접속

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { reportError } from "@/lib/error-report";

export const maxDuration = 60;

type Cohort = "all" | "founding" | "no_cat" | "dormant";

interface BroadcastBody {
  message?: unknown;
  cohort?: unknown;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }
  const service = createServiceClient(supabaseUrl, supabaseServiceKey);

  // 관리자 인증 (set-title 패턴) — Bearer token에서 user 확인 후 admins 테이블 조회
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return Response.json({ error: "인증 필요" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await service.auth.getUser(token);
  if (!user) return Response.json({ error: "인증 실패" }, { status: 401 });
  const { data: adminRow } = await service
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) return Response.json({ error: "관리자 권한 필요" }, { status: 403 });
  const adminId = user.id;

  let body: BroadcastBody;
  try {
    body = (await request.json()) as BroadcastBody;
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const cohort: Cohort =
    body.cohort === "founding" || body.cohort === "no_cat" || body.cohort === "dormant"
      ? body.cohort
      : "all";

  if (!message) {
    return Response.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }
  if (message.length > 1000) {
    return Response.json({ error: "메시지는 1000자 이내로 작성해주세요." }, { status: 400 });
  }

  // 운영자 본인 프로필 (sender_name·avatar 스냅샷)
  const { data: adminProfile } = await service
    .from("profiles")
    .select("nickname, avatar_url")
    .eq("id", adminId)
    .maybeSingle();
  const senderName =
    (adminProfile as { nickname?: string | null } | null)?.nickname ?? "도시공존 운영자";
  const senderAvatar =
    (adminProfile as { avatar_url?: string | null } | null)?.avatar_url ?? null;

  // 대상 사용자 조회
  let usersQuery = service.from("profiles").select("id, nickname").neq("id", adminId);

  if (cohort === "founding") {
    usersQuery = usersQuery.eq("admin_title", "founding_member");
  }

  const { data: targetUsers, error: usersErr } = await usersQuery;
  if (usersErr) {
    reportError("broadcast-dm/list-users", new Error(usersErr.message));
    return Response.json({ error: "사용자 조회 실패" }, { status: 500 });
  }

  let targets = (targetUsers ?? []) as Array<{ id: string; nickname: string | null }>;

  // 코호트 후처리 (catCount·last_sign_in_at 기준은 별도 조회 필요)
  if (cohort === "no_cat") {
    const { data: catsData } = await service.from("cats").select("caretaker_id");
    const haveCats = new Set(
      ((catsData ?? []) as Array<{ caretaker_id: string | null }>)
        .map((c) => c.caretaker_id)
        .filter(Boolean) as string[],
    );
    targets = targets.filter((u) => !haveCats.has(u.id));
  }

  if (cohort === "dormant") {
    // auth.users.last_sign_in_at은 service_role로 접근. 8~30일 미접속.
    const { data: authData, error: authErr } = await service.auth.admin.listUsers({
      perPage: 1000,
    });
    if (authErr) {
      reportError("broadcast-dm/list-auth-users", new Error(authErr.message));
      return Response.json({ error: "휴면 사용자 조회 실패" }, { status: 500 });
    }
    const now = Date.now();
    const dormantIds = new Set(
      (authData.users ?? [])
        .filter((u) => {
          if (!u.last_sign_in_at) return false;
          const days = Math.floor(
            (now - new Date(u.last_sign_in_at).getTime()) / 86400000,
          );
          return days >= 8 && days <= 30;
        })
        .map((u) => u.id),
    );
    targets = targets.filter((u) => dormantIds.has(u.id));
  }

  if (targets.length === 0) {
    return Response.json({ ok: true, sent: 0, failed: 0, totalTargets: 0 });
  }

  // 일괄 insert — 한 번에 1000건씩 청크
  const rows = targets.map((u) => ({
    sender_id: adminId,
    sender_name: senderName,
    sender_avatar_url: senderAvatar,
    receiver_id: u.id,
    receiver_name: u.nickname ?? "회원",
    body: message,
    photo_url: null,
  }));

  // 진단용 — chunk 1로 줄이고 첫 에러 메시지를 응답에 포함.
  // 출시 직후 평상시 운영 안정화되면 다시 CHUNK=500으로 복원 권장.
  const CHUNK = 1;
  let sent = 0;
  let failed = 0;
  let firstErrorMessage: string | null = null;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error: insertErr } = await service.from("direct_messages").insert(chunk);
    if (insertErr) {
      failed += chunk.length;
      if (!firstErrorMessage) firstErrorMessage = insertErr.message;
      reportError("broadcast-dm/insert-chunk", new Error(insertErr.message), {
        chunkStart: i,
        chunkSize: chunk.length,
      });
    } else {
      sent += chunk.length;
    }
  }

  return Response.json({
    ok: failed === 0,
    sent,
    failed,
    totalTargets: targets.length,
    cohort,
    firstError: firstErrorMessage,
  });
}
