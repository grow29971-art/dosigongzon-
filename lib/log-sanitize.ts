// ══════════════════════════════════════════
// 서버 로그 마스킹 유틸 (2026-07-26 보안 패치)
// paymentKey 원문·Toss 전체 오류 객체가 Vercel 로그/Sentry에 남지 않게 한다.
// 로그 저장소는 유출 시 2차 피해 표면 — 상관관계 추적에 필요한 만큼만 남긴다.
// (payment/confirm·webhook·cancel 3개 라우트가 사용하는 단일 유틸 —
//  한때 lib/payment-log.ts와 중복됐다가 이 파일로 최종 통일)
// ══════════════════════════════════════════

import { createHmac } from "node:crypto";

// paymentKey → 복원 불가 HMAC 다이제스트 12자리. 같은 키는 같은 값이 나와
// 로그끼리 상관관계 추적 가능. 토스 콘솔 대조는 함께 로깅되는 주문 id로 한다.
export function maskPaymentKey(key: string | null | undefined): string {
  if (!key) return "pk#none";
  const secret = process.env.TOSS_SECRET_KEY || "log-mask-fallback";
  return `pk#${createHmac("sha256", secret).update(key).digest("hex").slice(0, 12)}`;
}

// Toss 오류 응답에서 안전 필드만 추출 — 전체 객체는 카드번호 일부·구매자 정보 등이
// 포함될 수 있어 로깅 금지. code/status/message만 allowlist.
export function safeTossError(t: unknown): string {
  const o = (typeof t === "object" && t !== null ? t : {}) as Record<string, unknown>;
  const parts = [
    typeof o.code === "string" ? o.code : "unknown_code",
    typeof o.status === "string" || typeof o.status === "number" ? String(o.status) : null,
    typeof o.message === "string" ? o.message.slice(0, 200) : null,
  ];
  return parts.filter(Boolean).join(" | ");
}

// Postgres/PostgREST 오류 → 로그 안전 문자열.
// 오류 객체를 통째로 넘기면 details/hint에 제약 위반을 일으킨 "행 값 전체"가 담긴다 —
// 주문 테이블이면 수령인 이름·전화·주소가 그대로 로그에 남는다. message 자체도
// `Key (phone)=(010...) already exists` 처럼 값을 품으므로 괄호 값을 지운 뒤 패턴 치환한다.
export function safePgError(e: unknown): string {
  const o = (typeof e === "object" && e !== null ? e : {}) as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code : "unknown_code";
  const raw = typeof o.message === "string" ? o.message : "";
  const masked = raw
    .replace(/\([^()]*\)=\([^()]*\)/g, "(...)=(...)")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/01[016789][ -.]?\d{3,4}[ -.]?\d{4}/g, "[phone]");
  return `${code} | ${masked.slice(0, 200)}`;
}

// 예외 → 로그 안전 문자열. 메시지에 끼어들 수 있는 시크릿(URL 속 paymentKey 등)은
// 다이제스트로 치환한 뒤 길이 제한.
export function safeErrorMessage(
  e: unknown,
  secrets: Array<string | null | undefined> = [],
): string {
  let msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  for (const s of secrets) {
    if (s) msg = msg.split(s).join(maskPaymentKey(s));
  }
  return msg.slice(0, 300);
}
