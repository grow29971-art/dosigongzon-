// ══════════════════════════════════════════
// QR 지킴판 익명 제보 접수 (B-1)
//
// ⚠️ 법적 설계 원칙 (box/학대방지_캣맘보호_구현프롬프트.md):
// - 제보자 정보를 수집하지 않는다: IP·User-Agent·계정·GPS 어떤 것도 저장 금지.
//   위치는 QR에 심긴 zone_id(고정 구역)로만 태깅.
// - 피제보자 신원을 받지 않는다 (구조화 enum + 자유서술만, 서술은 admin만 열람).
// - zone_reports는 anon insert 정책이 없다 — 이 라우트가 Turnstile 검증을 통과한
//   요청만 service_role로 insert (캡차 강제, 스팸·무고 방지).
// - 판정하지 않는다 — status 기본값 'received'(접수)로만 생성.
// ══════════════════════════════════════════

import { createServiceClient } from "@/lib/supabase/service";
import { reportError } from "@/lib/error-report";

const INCIDENT_TYPES = ["violence", "poison_suspect", "trap_suspect", "shelter_damage", "abandonment", "other"] as const;
const OCCURRED_WHEN = ["now", "hours_ago", "today", "yesterday", "earlier", "unknown"] as const;
const ANIMAL_STATUS = ["fine", "injured", "dead", "missing", "unknown"] as const;

const DETAIL_MAX = 500;
const ZONE_DAILY_LIMIT = 30; // 구역당 일일 제보 상한 (도배 방지 — IP 저장 없이 구역 단위로만 제한)

async function verifyTurnstile(token: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // 프로덕션에서 키 미설정이면 차단 (fail-closed), 개발 환경만 bypass
    return process.env.VERCEL_ENV !== "production";
  }
  if (!token) return false;
  try {
    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (err) {
    reportError("zone-report:turnstile", err);
    return false;
  }
}

export async function POST(request: Request) {
  let body: {
    zone_id?: unknown;
    incident_type?: unknown;
    occurred_when?: unknown;
    animal_status?: unknown;
    detail?: unknown;
    token?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const zoneId = typeof body.zone_id === "string" ? body.zone_id : null;
  const incidentType = typeof body.incident_type === "string" ? body.incident_type : null;
  const occurredWhen = typeof body.occurred_when === "string" ? body.occurred_when : null;
  const animalStatus = typeof body.animal_status === "string" ? body.animal_status : null;
  const detailRaw = typeof body.detail === "string" ? body.detail.trim() : "";
  const token = typeof body.token === "string" ? body.token : null;

  if (
    !zoneId ||
    !incidentType || !(INCIDENT_TYPES as readonly string[]).includes(incidentType) ||
    !occurredWhen || !(OCCURRED_WHEN as readonly string[]).includes(occurredWhen) ||
    !animalStatus || !(ANIMAL_STATUS as readonly string[]).includes(animalStatus)
  ) {
    return Response.json({ error: "필수 항목을 선택해주세요." }, { status: 400 });
  }
  if (detailRaw.length > DETAIL_MAX) {
    return Response.json({ error: `상세 설명은 ${DETAIL_MAX}자 이내로 적어주세요.` }, { status: 400 });
  }

  // 봇 검증 (Turnstile)
  const human = await verifyTurnstile(token);
  if (!human) {
    return Response.json({ error: "봇 검증에 실패했어요. 새로고침 후 다시 시도해주세요." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 구역 존재·활성 확인
  const { data: zone, error: zoneErr } = await supabase
    .from("guardian_zones")
    .select("id, active")
    .eq("id", zoneId)
    .maybeSingle();
  if (zoneErr) {
    reportError("zone-report:zone-lookup", zoneErr);
    return Response.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }
  if (!zone || !zone.active) {
    return Response.json({ error: "등록되지 않았거나 운영이 끝난 구역이에요." }, { status: 404 });
  }

  // 구역당 일일 상한 (제보자 식별 정보 없이 구역 단위로만 도배 방지)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("zone_reports")
    .select("*", { count: "exact", head: true })
    .eq("zone_id", zoneId)
    .gte("created_at", dayAgo);
  if ((count ?? 0) >= ZONE_DAILY_LIMIT) {
    return Response.json(
      { error: "오늘은 이 구역 제보가 많이 접수됐어요. 긴급하면 112로 직접 신고해주세요." },
      { status: 429 },
    );
  }

  const { error: insertErr } = await supabase.from("zone_reports").insert({
    zone_id: zoneId,
    incident_type: incidentType,
    occurred_when: occurredWhen,
    animal_status: animalStatus,
    detail: detailRaw || null,
    // status·purge_at은 DB 기본값 (received / +90일)
  });
  if (insertErr) {
    reportError("zone-report:insert", insertErr);
    return Response.json({ error: "접수에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
