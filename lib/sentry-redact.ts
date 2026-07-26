// ══════════════════════════════════════════
// Sentry 이벤트 공통 PII redaction (2026-07-26 보안 패치)
// server/edge/client 세 config의 beforeSend에서 공용으로 사용 —
// Node 전용 API 금지 (edge 런타임·브라우저에서도 동작해야 함).
//
// 원칙: Authorization/Cookie/token/paymentKey 등 민감 키는 키 이름으로 제거하고,
// 문자열 값 속에 섞인 이메일·전화번호·토큰은 패턴으로 치환한다.
// URL은 query string을 통째로 버린다(토큰·검색어·좌표가 실려 오는 통로).
// ══════════════════════════════════════════

const REDACTED = "[redacted]";

const SENSITIVE_KEY =
  /authorization|cookie|token|secret|password|passwd|payment[-_]?key|api[-_]?key|session|email|phone|tel|address|contact|주소|연락처|전화|이메일/i;

// 문자열 값 안에 섞인 PII 패턴
const VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  [/01[016789][ -.]?\d{3,4}[ -.]?\d{4}/g, "[phone]"],
  [/Bearer\s+[\w\-.=]+/gi, "Bearer [redacted]"],
  [/eyJ[\w-]{8,}\.[\w-]+\.[\w-]+/g, "[jwt]"],
];

export function redactString(s: string): string {
  let out = s;
  for (const [re, sub] of VALUE_PATTERNS) out = out.replace(re, sub);
  return out;
}

function stripQuery(url: string): string {
  return url.split("?")[0].split("#")[0];
}

// 객체/배열 재귀 치환 — 민감 키는 값 전체를 지우고, url 키는 query를 버린다.
export function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = REDACTED;
    } else if (k === "url" && typeof v === "string") {
      out[k] = stripQuery(v);
    } else {
      out[k] = redactDeep(v, depth + 1);
    }
  }
  return out;
}

// Sentry Event 타입에 직접 의존하지 않는 느슨한 형태 — 세 런타임 SDK가 공유.
type AnyDict = Record<string, unknown>;
interface RedactableEvent {
  message?: unknown;
  request?: AnyDict;
  user?: AnyDict;
  extra?: AnyDict;
  contexts?: AnyDict;
  tags?: AnyDict;
  breadcrumbs?: Array<AnyDict>;
  exception?: { values?: Array<AnyDict> };
}

// 제약 없는 제네릭 + 내부 캐스팅: Sentry의 ErrorEvent(request 등에 index signature가
// 없는 구체 타입)를 그대로 받아 그대로 돌려줘야 세 런타임 beforeSend 시그니처를 만족한다.
export function redactSentryEvent<T>(event: T): T {
  const e = event as RedactableEvent;
  if (typeof e.message === "string") e.message = redactString(e.message);
  if (e.request) {
    if (typeof e.request.url === "string") e.request.url = stripQuery(e.request.url);
    // 헤더·쿠키·본문·query는 통째로 버린다 — allowlist에 넣을 만큼 필요한 적이 없음
    delete e.request.headers;
    delete e.request.cookies;
    delete e.request.query_string;
    delete e.request.data;
  }
  if (e.user) e.user = { id: e.user.id }; // ip_address·email 등 제거
  if (e.extra) e.extra = redactDeep(e.extra) as AnyDict;
  if (e.contexts) e.contexts = redactDeep(e.contexts) as AnyDict;
  if (e.tags) e.tags = redactDeep(e.tags) as AnyDict;
  if (Array.isArray(e.breadcrumbs)) {
    for (const b of e.breadcrumbs) {
      if (typeof b.message === "string") b.message = redactString(b.message);
      if (b.data) b.data = redactDeep(b.data);
    }
  }
  for (const v of e.exception?.values ?? []) {
    if (typeof v.value === "string") v.value = redactString(v.value);
  }
  return event;
}

// reportError()의 extra 안전 allowlist — 식별자·수치·상태류 키만 통과.
// 자유 문자열(본문·메시지·주소 등)은 키가 매치돼도 값 패턴 치환을 거친다.
const EXTRA_KEY_ALLOW =
  /^(id|.*Id|.*_id|status|code|count|action|scope|step|path|table|chunkStart|chunkSize)$/;

export function allowlistExtra(
  extra: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (!EXTRA_KEY_ALLOW.test(k)) continue;
    if (typeof v === "string") out[k] = redactString(v).slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
