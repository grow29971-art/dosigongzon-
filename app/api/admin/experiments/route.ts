// 관리자 전용 — 실험 생성/목록/지표 API
// RLS(admins 정책)에 더해 코드 레벨 이중 확인 (기존 admin API 패턴).
// 지표는 원자료 단순 집계 — 표본이 작으므로 화면에서 유의성 주장 금지 문구와 함께 표기.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeExperimentMetrics } from "@/lib/experiment-metrics";
import { isUuid, type ExperimentRow } from "@/lib/experiments-server";
import { kstToday, toKstDate } from "@/lib/kst";

async function requireAdminUser(): Promise<{ userId: string } | { error: NextResponse }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  }
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return { error: NextResponse.json({ error: "관리자 권한이 필요해요." }, { status: 403 }) };
  }
  return { userId: user.id };
}

// ── GET: ?id= 지표 상세 / 없으면 목록 ──
export async function GET(request: Request) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const svc = createServiceClient();
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    const { data: experiments } = await svc
      .from("experiments")
      .select("id, public_area_name, starts_at, ends_at, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (experiments ?? []) as ExperimentRow[];

    const withCounts = await Promise.all(
      list.map(async (exp) => {
        const { count } = await svc
          .from("experiment_members")
          .select("user_id", { count: "exact", head: true })
          .eq("experiment_id", exp.id);
        return { ...exp, member_count: count ?? 0 };
      }),
    );
    return NextResponse.json({ experiments: withCounts });
  }

  if (!isUuid(id)) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });

  const { data: exp } = await svc
    .from("experiments")
    .select("id, public_area_name, starts_at, ends_at, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!exp) return NextResponse.json({ error: "실험을 찾을 수 없어요." }, { status: 404 });

  const [membersRes, invitesRes, logsRes, eventsRes] = await Promise.all([
    svc.from("experiment_members").select("user_id, invited_by").eq("experiment_id", id),
    svc.from("experiment_invites").select("accepted_by").eq("experiment_id", id),
    svc.from("experiment_care_logs").select("user_id, cared_on").eq("experiment_id", id),
    svc.from("experiment_events").select("event").eq("experiment_id", id),
  ]);

  const metrics = computeExperimentMetrics({
    members: membersRes.data ?? [],
    invites: invitesRes.data ?? [],
    logs: logsRes.data ?? [],
    startsAt: exp.starts_at,
    endsAt: exp.ends_at,
    today: kstToday(),
  });

  const eventCounts: Record<string, number> = {};
  for (const row of eventsRes.data ?? []) {
    eventCounts[row.event] = (eventCounts[row.event] ?? 0) + 1;
  }

  return NextResponse.json({ experiment: exp, metrics, eventCounts });
}

// ── POST: 실험 생성 { publicAreaName, startsAt?, endsAt? } ──
// public_area_name에는 공개 가능한 지역명만 — 좌표·상세 주소를 넣지 않는 것은 운영 규칙으로 안내.
export async function POST(request: Request) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  let body: { publicAreaName?: unknown; startsAt?: unknown; endsAt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const name = typeof body.publicAreaName === "string" ? body.publicAreaName.trim() : "";
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: "지역명은 1~40자로 입력해 주세요." }, { status: 400 });
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const today = kstToday();
  const startsAt =
    typeof body.startsAt === "string" && DATE_RE.test(body.startsAt) ? body.startsAt : today;
  // 기본 14일 실험 (시작일 포함)
  const defaultEnd = toKstDate(new Date(new Date(startsAt + "T00:00:00+09:00").getTime() + 13 * 86_400_000));
  const endsAt =
    typeof body.endsAt === "string" && DATE_RE.test(body.endsAt) ? body.endsAt : defaultEnd;
  if (endsAt < startsAt) {
    return NextResponse.json({ error: "종료일이 시작일보다 빠를 수 없어요." }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: created, error } = await svc
    .from("experiments")
    .insert({ public_area_name: name, starts_at: startsAt, ends_at: endsAt, created_by: guard.userId })
    .select("id")
    .single();
  if (error || !created) {
    return NextResponse.json({ error: "실험 생성에 실패했어요." }, { status: 500 });
  }

  // 생성자는 자동 참여 — 초대의 출발점이 된다
  await svc.from("experiment_members").insert({
    experiment_id: created.id,
    user_id: guard.userId,
    invited_by: null,
  });

  return NextResponse.json({ ok: true, id: created.id });
}

// ── PATCH: 상태 변경 { id, status } (조기 종료 등) ──
export async function PATCH(request: Request) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  let body: { id?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const status = body.status as string;
  if (!isUuid(body.id) || !["draft", "active", "ended"].includes(status)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const svc = createServiceClient();
  const { error } = await svc.from("experiments").update({ status }).eq("id", body.id);
  if (error) return NextResponse.json({ error: "변경에 실패했어요." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
