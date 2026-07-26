// 로그 마스킹·Sentry redaction 테스트 — node --test tests/log-redaction.test.mjs
// (.mjs에서 .ts를 직접 import — Node 23.6+ 타입 스트리핑)
import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPaymentKey, safeTossError, safeErrorMessage } from "../lib/log-sanitize.ts";
import { redactSentryEvent, allowlistExtra, redactString } from "../lib/sentry-redact.ts";

// ── lib/log-sanitize (결제 로그) ──

test("maskPaymentKey: 원문 미포함 + 결정적 + 키별 상이", () => {
  const key = "tgen_20260726_SECRET_abcdef123456";
  const masked = maskPaymentKey(key);
  assert.match(masked, /^pk#[0-9a-f]{12}$/);
  assert.ok(!masked.includes("SECRET"));
  assert.equal(masked, maskPaymentKey(key));
  assert.notEqual(masked, maskPaymentKey("tgen_other_key"));
  assert.equal(maskPaymentKey(null), "pk#none");
});

test("safeTossError: code/status/message만 통과, 그 외 필드 폐기", () => {
  const out = safeTossError({
    code: "INVALID_CARD",
    message: "카드 오류",
    card: { number: "4111111111111111" },
    receipt: { url: "https://x/y?token=abc" },
  });
  assert.ok(out.includes("INVALID_CARD"));
  assert.ok(out.includes("카드 오류"));
  assert.ok(!out.includes("4111111111111111"));
  assert.ok(!out.includes("token"));
});

test("safeErrorMessage: 메시지에 낀 시크릿을 다이제스트로 치환", () => {
  const key = "tgen_SECRETKEY_999";
  const err = new Error(`fetch failed: https://api.tosspayments.com/v1/payments/${key}/cancel`);
  const out = safeErrorMessage(err, [key]);
  assert.ok(!out.includes(key));
  assert.ok(out.includes("pk#"));
});

// ── lib/sentry-redact (Sentry 공통) ──

test("redactSentryEvent: 헤더·쿠키·query 제거, user는 id만, 민감 키 삭제", () => {
  const event = {
    request: {
      url: "https://dosigongzon.com/mypage?token=abc&q=주소검색",
      headers: { Authorization: "Bearer xyz", Cookie: "sb=1" },
      cookies: { sb: "1" },
      query_string: "token=abc",
      data: { paymentKey: "pk_live" },
    },
    user: { id: "u-1", email: "a@b.com", ip_address: "1.2.3.4" },
    extra: { paymentKey: "tgen_raw", orderId: "ORD-1" },
    exception: { values: [{ value: "user a@b.com (010-1234-5678) failed" }] },
  };
  const out = redactSentryEvent(event);
  assert.equal(out.request.url, "https://dosigongzon.com/mypage");
  assert.equal(out.request.headers, undefined);
  assert.equal(out.request.cookies, undefined);
  assert.equal(out.request.query_string, undefined);
  assert.equal(out.request.data, undefined);
  assert.deepEqual(out.user, { id: "u-1" });
  assert.equal(out.extra.paymentKey, "[redacted]");
  assert.equal(out.extra.orderId, "ORD-1");
  const msg = out.exception.values[0].value;
  assert.ok(!msg.includes("a@b.com"));
  assert.ok(!msg.includes("010-1234-5678"));
});

test("redactString: 이메일·전화·Bearer·JWT 패턴 치환", () => {
  const out = redactString(
    "mail a@b.co phone 010-1234-5678 auth Bearer abc.def jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
  );
  assert.ok(!out.includes("a@b.co"));
  assert.ok(!out.includes("010-1234-5678"));
  assert.ok(!/Bearer abc/.test(out));
  assert.ok(!out.includes("eyJhbGciOiJIUzI1NiJ9"));
});

test("allowlistExtra: 식별자·수치 키만 통과, 자유 문자열 키 폐기", () => {
  const out = allowlistExtra({
    userId: "u-1",
    chunkStart: 0,
    chunkSize: 50,
    body: "010-9999-8888로 연락주세요",
    email: "x@y.z",
    address: "서울시 어딘가 123",
  });
  assert.deepEqual(Object.keys(out).sort(), ["chunkSize", "chunkStart", "userId"]);
});

test("allowlistExtra: 통과 키의 문자열 값도 패턴 치환을 거친다", () => {
  const out = allowlistExtra({ userId: "문의: a@b.com" });
  assert.ok(!out.userId.includes("a@b.com"));
});
