// 2026-07-26 보안 패치 회귀 테스트 (순수 함수 / 로직 미러)
// 실행: npx --yes tsx scripts/test-security-patch.ts
// 레포에 테스트 러너가 없어 단독 스크립트로 유지. DB·네트워크 없이 순수 로직만 검증.

import assert from "node:assert/strict";
import { redactSentryEvent, redactString, allowlistExtra } from "../lib/sentry-redact";
import { maskPaymentKey, safeTossError, safeErrorMessage } from "../lib/log-sanitize";

let passed = 0;
const ok = (label: string) => { passed++; void label; };

// ══════════════════════════════════════════
// 1. Sentry PII redaction
// ══════════════════════════════════════════
{
  // 문자열 값 속 이메일·전화·JWT·Bearer 치환
  assert.equal(redactString("연락 test.user@example.com 주세요"), "연락 [email] 주세요");
  assert.equal(redactString("전화 010-1234-5678"), "전화 [phone]");
  assert.equal(redactString("Authorization: Bearer abc.def.ghijkl"), "Authorization: Bearer [redacted]");
  assert.ok(redactString("token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMe").includes("[jwt]"));
  ok("redactString patterns");

  // 이벤트 레벨: user 제거, request 헤더/쿠키/query/body 제거 + url query strip
  const event = {
    message: "error for a@b.com",
    user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4" },
    request: {
      url: "https://x.com/api/pay?paymentKey=SECRET123&amount=1000",
      headers: { Authorization: "Bearer zzz" },
      cookies: { session: "s" },
      query_string: "paymentKey=SECRET123",
      data: { paymentKey: "SECRET123" },
    },
    extra: { paymentKey: "SECRET123", email: "a@b.com", orderId: "ord_1", note: "call 010-1111-2222" },
    tags: { scope: "payment" },
    breadcrumbs: [{ message: "user a@b.com clicked", data: { url: "https://x.com/p?token=t" } }],
    exception: { values: [{ value: "failed for a@b.com" }] },
  };
  const r = redactSentryEvent(structuredClone(event)) as typeof event;

  assert.deepEqual(r.user, { id: "u1" }); // id만 유지, email·ip_address 제거
  assert.equal(r.request.headers, undefined);
  assert.equal(r.request.cookies, undefined);
  assert.equal(r.request.query_string, undefined);
  assert.equal(r.request.data, undefined);
  assert.equal(r.request.url, "https://x.com/api/pay"); // query 제거
  assert.equal(r.extra.paymentKey, "[redacted]");       // 민감 키 제거
  assert.equal(r.extra.email, "[redacted]");
  assert.equal(r.extra.orderId, "ord_1");               // 비민감 키 유지
  assert.equal(r.extra.note, "call [phone]");            // 값 속 전화 치환
  assert.ok(!r.message.includes("a@b.com"));            // 메시지 치환
  assert.equal(r.breadcrumbs[0].data.url, "https://x.com/p"); // breadcrumb url query 제거
  assert.ok(!r.exception.values[0].value.includes("a@b.com"));
  ok("redactSentryEvent");

  // allowlistExtra — 식별자/수치만 통과, 자유 문자열 키는 제거, 문자열 값도 스크럽
  const safe = allowlistExtra({
    orderId: "ord_1", count: 3, ok: true,
    email: "a@b.com", address: "서울시 …", message: "본문", note: "010-1234-5678",
  });
  assert.deepEqual(safe, { orderId: "ord_1", count: 3 });
  assert.equal(allowlistExtra(undefined), undefined);
  ok("allowlistExtra");
}

// ══════════════════════════════════════════
// 2. 결제 로그 마스킹
// ══════════════════════════════════════════
{
  const key = "tviva20240101ABCDEF";
  const masked = maskPaymentKey(key);
  assert.ok(masked.startsWith("pk#"));
  assert.ok(!masked.includes(key));                    // 원문 미포함
  assert.equal(maskPaymentKey(key), maskPaymentKey(key)); // 결정적(상관관계 추적 가능)
  assert.equal(maskPaymentKey(null), "pk#none");
  ok("maskPaymentKey");

  // 토스 오류: allowlist(code/status/message)만, 그 외 필드(카드정보 등) 제거
  const toss = { code: "INVALID_CARD", status: 400, message: "카드 오류", cardNumber: "1234-5678-9012-3456", buyerName: "홍길동" };
  const s = safeTossError(toss);
  assert.ok(s.includes("INVALID_CARD") && s.includes("400") && s.includes("카드 오류"));
  assert.ok(!s.includes("1234-5678") && !s.includes("홍길동"));
  ok("safeTossError allowlist");

  // 예외 메시지 속 paymentKey는 다이제스트로 치환
  const err = new Error(`fetch failed https://api.tosspayments.com/v1/payments/${key}`);
  const em = safeErrorMessage(err, [key]);
  assert.ok(!em.includes(key));
  assert.ok(em.includes("pk#"));
  ok("safeErrorMessage secret scrub");
}

// ══════════════════════════════════════════
// 3. 서클 사진 비공개 참조 검증 (sw와 무관 — regex 미러)
//    lib/circle-chat-repo의 PRIVATE_REF_RE와 동일 규약
// ══════════════════════════════════════════
{
  const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const RE = new RegExp(`^private:${UUID}/${UUID}/${UUID}\\.webp$`, "i");
  const u = "11111111-1111-1111-1111-111111111111";
  assert.ok(RE.test(`private:${u}/${u}/${u}.webp`));
  assert.ok(!RE.test(`https://evil.com/x.webp`));
  assert.ok(!RE.test(`private:${u}/../secret.webp`));
  assert.ok(!RE.test(`private:${u}/${u}/${u}.exe`));
  ok("circle private ref regex");
}

// ══════════════════════════════════════════
// 4. SW push URL 차단 (sw.js safeNotificationUrl 로직 미러)
// ══════════════════════════════════════════
{
  const ORIGIN = "https://dosigongzon.com";
  const PUSH_PATH_PREFIXES = [
    "/cats", "/messages", "/map", "/mypage", "/community",
    "/notifications", "/experiment", "/shop", "/protection", "/tips",
  ];
  const safeNotificationUrl = (raw: string) => {
    try {
      const u = new URL(raw || "/", ORIGIN);
      if (u.origin !== ORIGIN) return "/";
      const okPath = u.pathname === "/" ||
        PUSH_PATH_PREFIXES.some((p) => u.pathname === p || u.pathname.startsWith(p + "/"));
      return okPath ? u.pathname + u.search + u.hash : "/";
    } catch { return "/"; }
  };

  assert.equal(safeNotificationUrl("/cats/123"), "/cats/123");        // 허용 경로
  assert.equal(safeNotificationUrl("/messages"), "/messages");
  assert.equal(safeNotificationUrl("/"), "/");
  assert.equal(safeNotificationUrl("https://evil.com/phish"), "/");   // 외부 오리진 차단
  assert.equal(safeNotificationUrl("//evil.com"), "/");               // 프로토콜 상대 차단
  assert.equal(safeNotificationUrl("javascript:alert(1)"), "/");      // 스킴 주입 차단
  assert.equal(safeNotificationUrl("/admin/users"), "/");             // 비허용 내부 경로 차단
  assert.equal(safeNotificationUrl("https://dosigongzon.com.evil.com/x"), "/"); // 유사 도메인 차단
  ok("SW push url allowlist");
}

// ══════════════════════════════════════════
// 5. JSON-LD script 탈출 차단 (< → <)
// ══════════════════════════════════════════
{
  const escapeJsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
  const payload = { name: "</script><img src=x onerror=alert(1)>" };
  const out = escapeJsonLd(payload);
  assert.ok(!out.includes("</script>"));   // 리터럴 </script> 없음
  assert.ok(out.includes("\\u003c"));      // < 이스케이프됨
  // JSON 의미는 보존 (파싱하면 원문 복원)
  assert.equal(JSON.parse(out).name, "</script><img src=x onerror=alert(1)>");
  ok("JSON-LD escape");
}

console.log(`✅ security-patch: ${passed}개 검증 그룹 모두 통과`);
