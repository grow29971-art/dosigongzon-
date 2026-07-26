// 보안 패치 소스 불변식 테스트 — node --test tests/security-invariants.test.mjs
// 경제성 API fail-closed·결제 로그 마스킹·XSS 이스케이프가 리팩토링으로
// 되돌아가지 않도록 소스 레벨에서 가드한다 (2026-07-26 보안 패치 회귀 가드).
// (라우트는 next/server 의존이라 직접 import 대신 소스 검사 — DB 동시성의
//  실질 방어선은 "변이는 원자 RPC로만, 실패 시 503"이라는 코드 형태 자체다)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSafeImageUrl } from "../lib/url-validate.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── 1. 경제성 API fail-closed (비원자 폴백 금지 + RPC 실패 시 503) ──

const FAIL_CLOSED_ROUTES = [
  // [파일, 필수 RPC 이름, 금지 패턴(비원자 폴백 흔적)]
  ["app/api/shop/buy/route.ts", "buy_shop_item_atomic", ['.from("user_items")', '.from("profiles")']],
  ["app/api/shop/use-item/route.ts", "consume_user_item", ['.from("user_items")']],
  ["app/api/cats/equip-item/route.ts", "equip_item_atomic", ['.from("user_items")', '.from("cats")']],
];

for (const [file, rpc, forbidden] of FAIL_CLOSED_ROUTES) {
  test(`${file}: ${rpc} RPC 전용 + 503 fail-closed + 비원자 폴백 없음`, () => {
    const src = read(file);
    assert.ok(src.includes(`"${rpc}"`), `원자 RPC(${rpc}) 호출이 있어야 함`);
    assert.ok(/status:\s*503/.test(src), "RPC 실패 시 503 fail-closed 경로가 있어야 함");
    for (const marker of forbidden) {
      assert.ok(!src.includes(marker), `비원자 폴백 흔적 금지: ${marker}`);
    }
  });
}

test("코인 지급 라우트(daily-login/care-bonus/checkin): 503 fail-closed 유지", () => {
  for (const file of [
    "app/api/coins/daily-login/route.ts",
    "app/api/coins/care-bonus/route.ts",
    "app/api/checkin/complete/route.ts",
  ]) {
    const src = read(file);
    assert.ok(/status:\s*503/.test(src), `${file}: 503 경로 필요`);
    assert.ok(!src.includes('.update({ coins'), `${file}: 코인 read-modify-write 금지`);
  }
});

// ── 2. 결제 로그 마스킹 (paymentKey 원문·토스 전체 오류 객체 로깅 금지) ──

const PAYMENT_ROUTES = [
  "app/api/payment/confirm/route.ts",
  "app/api/payment/webhook/route.ts",
  "app/api/payment/cancel/route.ts",
];

test("결제 라우트: console 호출에 paymentKey 원문 전달 금지", () => {
  for (const file of PAYMENT_ROUTES) {
    const src = read(file);
    for (const line of src.split("\n")) {
      if (!/console\.(error|warn|log)/.test(line)) continue;
      if (!/payment_?[Kk]ey/.test(line)) continue;
      assert.ok(
        /maskPaymentKey\(|safeErrorMessage\(/.test(line),
        `${file}: 마스킹 없는 paymentKey 로깅 — ${line.trim()}`,
      );
    }
    // 토스 응답 본문을 통째로 로그에 흘리는 패턴 금지
    assert.ok(!/console\.[a-z]+\([^\n]*\.text\(\)/.test(src), `${file}: 응답 본문 원문 로깅 금지`);
  }
});

test("결제 라우트: 마스킹 유틸(lib/log-sanitize) 사용", () => {
  for (const file of PAYMENT_ROUTES) {
    assert.ok(read(file).includes('from "@/lib/log-sanitize"'), `${file}: log-sanitize import 필요`);
  }
});

// ── 3. 저장형 XSS ──

test("shop/[id] JSON-LD: '<' 유니코드 이스케이프로 script 탈출 차단", () => {
  const src = read("app/(main)/shop/[id]/page.tsx");
  // 소스에는 문자 그대로 백슬래시 2개 + u003c 가 있어야 한다: .replace(/</g, "\\u003c")
  const needle = 'replace(/</g, "' + "\\\\" + 'u003c")';
  assert.ok(src.includes(needle), "JSON.stringify 후 < 치환 필요");
});

test("map 병원 마커: 병원명은 escapeHtml을 거쳐서만 innerHTML에 삽입", () => {
  const src = read("app/(main)/map/page.tsx");
  assert.match(src, /const label = escapeHtml\(/);
  assert.match(src, /function escapeHtml\(/);
  // 동 이름도 이스케이프 유지
  assert.match(src, /escapeHtml\(dong\)/);
});

test("isSafeImageUrl: 인용부호·스킴 주입 페이로드 거부 (CSS url() 내삽 방어)", () => {
  assert.equal(isSafeImageUrl("https://x.com/a.webp"), true);
  assert.equal(isSafeImageUrl("https://x.com/a');<img onerror=alert(1)>"), false);
  assert.equal(isSafeImageUrl(`https://x.com/a"b`), false);
  assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeImageUrl("data:text/html,x"), false);
});

// ── 4. 서버 전용 경계 ──

test("lib/supabase/service.ts: server-only 하드 경계 유지", () => {
  assert.ok(read("lib/supabase/service.ts").includes('import "server-only"'));
});

// ── 5. Sentry 설정: sendDefaultPii=false + 공통 redaction 연결 ──

test("sentry config 3종: sendDefaultPii false + redactSentryEvent 연결", () => {
  for (const file of ["sentry.server.config.ts", "sentry.edge.config.ts", "sentry.client.config.ts"]) {
    const src = read(file);
    assert.ok(src.includes("sendDefaultPii: false"), `${file}: sendDefaultPii false 필요`);
    assert.ok(src.includes("redactSentryEvent"), `${file}: 공통 redaction 필요`);
  }
});
