// 보안 회귀 가드 — node --test tests/security-guard.test.mjs
// 1) 결제·쇼핑 API 라우트가 미인증 요청을 막는 형태를 유지하는지 (정적 lint성 검사)
// 2) 시크릿 환경변수가 클라이언트("use client") 코드에 스며들지 않는지
//
// 방식: security-invariants.test.mjs와 동일하게 소스 레벨 검사.
// (라우트는 next/server 의존이라 직접 import 불가 — "인증 코드의 형태 자체"를 봉인한다)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

// 주석 제거 — 주석 속 단어가 오탐되지 않게. `://`(URL)는 보존.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const listFiles = (dir) =>
  readdirSync(new URL(dir, root), { recursive: true })
    .map((f) => dir + String(f).replace(/\\/g, "/"))
    .filter((f) => /\.(ts|tsx)$/.test(f));

// ══════════════════════════════════════════════════════════
// 1. 결제·쇼핑 라우트 인증 회귀 가드
// ══════════════════════════════════════════════════════════
// 규칙: app/api/payment/**, app/api/shop/** 의 모든 route.ts는
//   (a) supabase.auth.getUser() + 401 거부 경로를 갖거나
//   (b) AUTH_EXEMPT에 사유·대체 방어 패턴과 함께 등록되어야 한다.
// 새 라우트를 추가하면 자동으로 검사 대상이 되고, 인증 없이 추가하면 여기서 깨진다.

const GUARDED_API_DIRS = ["app/api/payment/", "app/api/shop/"];

// 세션 인증 대신 다른 방어선을 쓰는 라우트 — 반드시 사유 + 검증 가능한 패턴 명시.
// 여기에 추가하는 것 자체가 보안 리뷰 게이트다.
const AUTH_EXEMPT = {
  "app/api/payment/webhook/route.ts": {
    reason:
      "토스 웹훅 — 세션 없음. 본문을 신뢰하지 않고 토스 결제 조회 API(시크릿 키 인증)로 재검증하는 것이 방어선",
    mustInclude: ["TOSS_SECRET_KEY", "api.tosspayments.com/v1/payments/"],
  },
  "app/api/shop/donation-progress/route.ts": {
    reason: "공개 읽기 전용 후원 집계 (쇼핑 홈 진행바)",
    readOnly: true,
  },
  "app/api/shop/fund-settlement/route.ts": {
    reason: "공개 읽기 전용 후원금 정산 요약",
    readOnly: true,
  },
  "app/api/shop/wishlist/route.ts": {
    reason:
      "찜 계측 수집 — 비로그인 방문자의 찜이 측정 대상(결제 오픈 게이트)이라 세션 인증 불가. /api/funnel과 동일 방어선: IP 레이트리밋 + anonId 길이 검증 + productId UUID 검증, 쓰기는 계측 테이블 insert뿐(RLS 정책 0개로 클라이언트 접근 차단)",
    mustInclude: [
      "rateLimit(`wishlist:${ip}`",
      "anonId.length < 8 || anonId.length > 64",
      "UUID_RE.test(body.productId)",
    ],
  },
};

const guardedRoutes = GUARDED_API_DIRS.flatMap((dir) =>
  listFiles(dir).filter((f) => f.endsWith("/route.ts")),
);

test("결제·쇼핑 라우트 목록이 비어있지 않음 (디렉터리 이동 시 이 테스트도 갱신)", () => {
  assert.ok(guardedRoutes.length >= 8, `발견된 라우트 ${guardedRoutes.length}개 — 경로 확인 필요`);
});

test("AUTH_EXEMPT에 등록된 라우트는 전부 실존 (죽은 예외 방지)", () => {
  for (const file of Object.keys(AUTH_EXEMPT)) {
    assert.ok(guardedRoutes.includes(file), `예외 등록됐지만 파일 없음: ${file} — 예외 목록에서 제거할 것`);
  }
});

for (const file of guardedRoutes) {
  const exempt = AUTH_EXEMPT[file];

  if (!exempt) {
    test(`${file}: auth.getUser() + 401 거부 경로 필수`, () => {
      const src = stripComments(read(file));
      assert.ok(
        src.includes("auth.getUser()"),
        `${file}: supabase.auth.getUser() 인증 체크가 없음 — 미인증 결제/구매 허용 위험`,
      );
      assert.ok(
        /status:\s*401/.test(src),
        `${file}: 미인증 시 401 거부 경로가 없음`,
      );
    });
    continue;
  }

  if (exempt.mustInclude) {
    test(`${file}: 인증 예외(${exempt.reason.slice(0, 30)}…) — 대체 방어 패턴 유지`, () => {
      const src = read(file);
      for (const marker of exempt.mustInclude) {
        assert.ok(src.includes(marker), `${file}: 대체 방어 흔적 소실 — '${marker}' 필요`);
      }
    });
  }

  if (exempt.readOnly) {
    test(`${file}: 공개 예외 — 읽기 전용 유지 (변이 API로 진화 금지)`, () => {
      const src = stripComments(read(file));
      assert.ok(
        !/export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)/.test(src),
        `${file}: 공개 라우트에 변이 메서드 추가 금지 — 추가하려면 인증을 붙이고 예외에서 제거할 것`,
      );
      for (const banned of [".insert(", ".update(", ".delete(", ".upsert(", ".rpc("]) {
        assert.ok(!src.includes(banned), `${file}: 공개 읽기 전용 라우트에서 DB 변이 금지 — '${banned}' 발견`);
      }
    });
  }
}

// 결제 confirm의 핵심 무결성 검증(금액 대조·서버 재계산·중복 confirm 멱등)이
// 리팩토링으로 소실되지 않도록 마커 봉인
test("payment/confirm: 금액 위변조 검증 + 서버 재계산 + 중복 confirm 멱등 유지", () => {
  const src = read("app/api/payment/confirm/route.ts");
  assert.ok(src.includes("order.payment_amount !== amount"), "요청 금액 ↔ 주문 금액 대조 소실");
  assert.match(src, /expected\s*!==\s*order\.payment_amount/, "서버 측 금액 재계산 검증 소실");
  assert.ok(
    /order\.status === "paid" && order\.payment_key === paymentKey/.test(src),
    "동일 paymentKey 재요청 멱등 처리(새로고침 중복 confirm) 소실",
  );
  assert.ok(src.includes('order.user_id !== user.id'), "타인 주문 confirm 차단(403) 소실");
});

// ══════════════════════════════════════════════════════════
// 2. 환경변수 유출 가드 — 클라이언트 코드에 시크릿 금지
// ══════════════════════════════════════════════════════════
// "use client" 파일에서:
//   (a) process.env.X 는 NEXT_PUBLIC_* 또는 NODE_ENV만 허용
//       (그 외는 번들에서 undefined — 버그이자 시크릿을 클라로 옮기려는 신호)
//   (b) 시크릿 이름 자체가 등장 금지 (문자열/변수 어디에도)
//   (c) 서버 전용 supabase 모듈 import 금지
//   (d) process.env[...] 동적 접근 금지 (Next 인라이닝 불가 — 항상 undefined)

const SECRET_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOSS_SECRET_KEY",
  "TURNSTILE_SECRET_KEY",
  "VAPID_PRIVATE_KEY",
  "META_PIXEL_ACCESS_TOKEN",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "CRON_SECRET",
];

const isClientFile = (src) => /(^|\n)\s*['"]use client['"]/.test(src.slice(0, 300));

const allSources = [...listFiles("app/"), ...listFiles("lib/")];
const clientFiles = allSources.filter((f) => isClientFile(read(f)));

test("클라이언트 파일 스캔 대상이 존재함 (0이면 스캔 자체가 고장)", () => {
  assert.ok(clientFiles.length > 10, `use client 파일 ${clientFiles.length}개 — 탐지 로직 확인 필요`);
});

test("use client 파일: process.env는 NEXT_PUBLIC_* / NODE_ENV만", () => {
  const violations = [];
  for (const f of clientFiles) {
    const src = stripComments(read(f));
    for (const m of src.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const name = m[1];
      if (name.startsWith("NEXT_PUBLIC_") || name === "NODE_ENV") continue;
      violations.push(`${f} → process.env.${name}`);
    }
  }
  assert.deepEqual(violations, [], `클라이언트에서 비공개 env 참조:\n${violations.join("\n")}`);
});

test("use client 파일: 시크릿 env 이름 자체 등장 금지", () => {
  const violations = [];
  for (const f of clientFiles) {
    const src = stripComments(read(f));
    for (const name of SECRET_ENV_NAMES) {
      if (src.includes(name)) violations.push(`${f} → ${name}`);
    }
  }
  assert.deepEqual(violations, [], `클라이언트 코드에 시크릿 이름 노출:\n${violations.join("\n")}`);
});

test("use client 파일: 서버 전용 supabase 모듈 import 금지", () => {
  const violations = [];
  for (const f of clientFiles) {
    const src = stripComments(read(f));
    if (/from\s+["'](@\/)?lib\/supabase\/(service|server)["']/.test(src)) {
      violations.push(f);
    }
  }
  assert.deepEqual(violations, [], `클라이언트에서 서버 supabase import:\n${violations.join("\n")}`);
});

test("use client 파일: process.env[동적키] 접근 금지 (인라이닝 불가 → 항상 undefined)", () => {
  const violations = clientFiles.filter((f) => /process\.env\[/.test(stripComments(read(f))));
  assert.deepEqual(violations, [], `동적 env 접근:\n${violations.join("\n")}`);
});

// 3중 안전핀: 어떤 경로로든 service_role 문자열이 app/ 클라이언트 번들 후보에 못 들어가게
test("service_role 리터럴은 lib/supabase/service.ts 계열 서버 파일에만", () => {
  const violations = [];
  for (const f of allSources) {
    const src = stripComments(read(f));
    if (!src.includes("SUPABASE_SERVICE_ROLE_KEY")) continue;
    // 허용: 서버 전용 경계가 선언된 파일, app/api/** (서버 라우트), lib/** 중 "use client" 아닌 것
    const serverOnly = read(f).includes('import "server-only"');
    const isApiRoute = f.startsWith("app/api/");
    const isServerLib = f.startsWith("lib/") && !isClientFile(read(f));
    if (serverOnly || isApiRoute || isServerLib) continue;
    violations.push(f);
  }
  assert.deepEqual(violations, [], `service_role 키 참조가 서버 경계 밖:\n${violations.join("\n")}`);
});
