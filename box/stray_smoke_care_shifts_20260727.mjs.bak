// ══════════════════════════════════════════
// P3 돌봄교대 실물 스모크 (TASK 4 — 2026-07-27)
// 목적: box/supabase_care_shifts_migration.sql을 실 DB에 적용한 뒤,
//   /api/care-shifts 실호출로 요청 생성 → 중복 → 수락 → 재수락 → 완료 흐름의
//   기대 에러코드가 실제로 나오는지 1회 검증한다. (코드 62번째 다듬기 아님 — 실물 확인)
//
// ⚠️ 이 스크립트는 운영 DB를 "쓴다"(care_shifts 행 1건 생성/전이). 스테이징 권장.
//   실행은 사장님이 마이그레이션 적용 + 플래그 ON 이후에 수행.
//
// 인증: care-shifts 라우트는 쿠키 세션 기반이라, 브라우저에서 로그인 후 개발자도구
//   Application → Cookies 에서 sb-...-auth-token 쿠키 문자열을 복사해 env로 넘긴다.
//   (Authorization 헤더 방식이 아니므로 Cookie 헤더로 전달) — 시크릿은 코드에 넣지 않는다.
//
// 필요 env:
//   BASE_URL          기본 https://dosigongzon.com
//   REQUESTER_COOKIE  요청자(circle 소유/멤버) 로그인 쿠키 (예: "sb-xxx-auth-token=...; ...")
//   ASSIGNEE_COOKIE   수임자(circle 멤버) 로그인 쿠키 — 전이(PATCH)는 수임자만 가능
//   CIRCLE_ID         요청자가 소유/가입한 서클 UUID
//   ASSIGNEE_ID       수임자 유저 UUID (해당 서클 멤버)
//   STARTS_AT         선택. ISO. 기본 now+1h
//
// 실행: node box/smoke_care_shifts.mjs
// ══════════════════════════════════════════

const BASE_URL = process.env.BASE_URL || "https://dosigongzon.com";
const REQUESTER_COOKIE = process.env.REQUESTER_COOKIE || "";
const ASSIGNEE_COOKIE = process.env.ASSIGNEE_COOKIE || "";
const CIRCLE_ID = process.env.CIRCLE_ID || "";
const ASSIGNEE_ID = process.env.ASSIGNEE_ID || "";
const STARTS_AT = process.env.STARTS_AT || new Date(Date.now() + 3600_000).toISOString();

function must(name, val) {
  if (!val) { console.error(`✗ env ${name} 누락 — 상단 주석의 필요 env 참조`); process.exit(2); }
}
must("REQUESTER_COOKIE", REQUESTER_COOKIE);
must("ASSIGNEE_COOKIE", ASSIGNEE_COOKIE);
must("CIRCLE_ID", CIRCLE_ID);
must("ASSIGNEE_ID", ASSIGNEE_ID);

const results = [];
function check(label, actual, expected) {
  const ok = actual === expected;
  results.push({ label, actual, expected, ok });
  console.log(`${ok ? "✓" : "✗"} ${label} — status ${actual} (기대 ${expected})`);
  return ok;
}

async function call(method, cookie, body) {
  const res = await fetch(`${BASE_URL}/api/care-shifts`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

console.log(`\n=== P3 돌봄교대 스모크 (${BASE_URL}) ===`);

// 0) 사전 점검 — 플래그/마이그레이션 상태 빠른 진단
{
  const probe = await call("GET", REQUESTER_COOKIE);
  if (probe.status === 404) {
    console.error("✗ 404 not_found — P3 플래그(NEXT_PUBLIC_FF_CJ_CARE_SHIFT)가 꺼져 있음. 켠 뒤 재실행.");
    process.exit(1);
  }
  if (probe.status === 503 || probe.json?.error === "not_ready") {
    console.error("✗ 503 not_ready — care_shifts 마이그레이션 미적용. box/supabase_care_shifts_migration.sql 실행 후 재실행.");
    process.exit(1);
  }
  if (probe.status === 401) {
    console.error("✗ 401 unauthorized — REQUESTER_COOKIE 만료/무효. 브라우저에서 다시 복사.");
    process.exit(1);
  }
  console.log(`  사전 GET status ${probe.status} (목록 조회 OK)`);
}

// 1) 생성 → 201
const create = await call("POST", REQUESTER_COOKIE, {
  circle_id: CIRCLE_ID,
  assignee_id: ASSIGNEE_ID,
  starts_at: STARTS_AT,
  note: "smoke",
});
check("생성(create)", create.status, 201);
const shiftId = create.json?.shift?.id;
if (!shiftId) {
  console.error("✗ shift.id 없음 — 이후 단계 진행 불가. 응답:", JSON.stringify(create.json));
  process.exit(1);
}

// 2) 동일 파라미터 재생성 → 409 duplicate_request (유니크 위반 23505 경로)
const dup = await call("POST", REQUESTER_COOKIE, {
  circle_id: CIRCLE_ID,
  assignee_id: ASSIGNEE_ID,
  starts_at: STARTS_AT,
  note: "smoke-dup",
});
check("중복 생성 차단(duplicate_request)", dup.status, 409);
if (dup.json?.error) console.log(`   error=${dup.json.error}`);

// 3) 수락(assignee) → 200 accepted
const accept = await call("PATCH", ASSIGNEE_COOKIE, { id: shiftId, status: "accepted" });
check("수락(accept)", accept.status, 200);
if (accept.json?.shift?.status) console.log(`   status=${accept.json.shift.status}`);

// 4) 재수락(pending 아님) → 409 invalid_transition (전이 규율)
const reAccept = await call("PATCH", ASSIGNEE_COOKIE, { id: shiftId, status: "accepted" });
check("잘못된 전이 차단(invalid_transition)", reAccept.status, 409);
if (reAccept.json?.error) console.log(`   error=${reAccept.json.error}`);

// 5) 완료(assignee) → 200 completed
const complete = await call("PATCH", ASSIGNEE_COOKIE, { id: shiftId, status: "completed" });
check("완료(complete)", complete.status, 200);
if (complete.json?.shift?.status) console.log(`   status=${complete.json.shift.status}`);

// 요약
const passed = results.filter((r) => r.ok).length;
console.log(`\n=== 결과: ${passed}/${results.length} 통과 ===`);
if (passed !== results.length) {
  console.log("실패 항목:");
  for (const r of results.filter((x) => !x.ok)) console.log(`  ✗ ${r.label}: ${r.actual} (기대 ${r.expected})`);
  process.exit(1);
}
console.log("✅ 전 단계 기대 상태코드 일치 — 실 DB에서 트리거/유니크/전이 규율 확정.");
console.log("생성된 테스트 shift는 completed 상태로 남습니다(삭제 규칙상 drop/delete 금지 — 스테이징 권장).");
