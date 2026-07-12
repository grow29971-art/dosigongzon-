// Meta Pixel Conversions API (CAPI) — 서버사이드 전환 추적.
// ★ 반드시 쿠키 동의(dosigongzon_cookie_consent=accepted)를 확인한 호출부에서만 사용할 것.
//   동의 없이 호출하면 개보법 위반 소지 — 게이트는 호출부 책임 (예: auth/callback).
// 클라이언트 fbq와 같은 event_id로 dedup.
//
// 활성 조건:
//  - NEXT_PUBLIC_META_PIXEL_ID 설정됨
//  - META_PIXEL_ACCESS_TOKEN 설정됨 (Meta Business Manager → System User Access Token)
// 둘 중 하나라도 없으면 silent skip — 기능 점진 도입 가능.

const PIXEL_ID_RAW = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN_RAW = process.env.META_PIXEL_ACCESS_TOKEN;

function clean(s: string | undefined): string | null {
  return ((s ?? "").trim().replace(/^["']|["']$/g, "")) || null;
}

const PIXEL_ID = clean(PIXEL_ID_RAW);
const ACCESS_TOKEN = clean(ACCESS_TOKEN_RAW);

type StandardEvent =
  | "PageView"
  | "Lead"
  | "CompleteRegistration"
  | "ViewContent"
  | "Search"
  | "Contact"
  | "Subscribe";

export interface CAPIEventInput {
  eventName: StandardEvent;
  /** dedup용 — 클라이언트 fbq의 eventID와 일치시키면 중복 카운트 안 됨. user.id 등 안정적 값 권장. */
  eventId: string;
  /** 사용자 식별 (해시 후 전송) */
  userId?: string;
  userEmail?: string | null;
  /** 이벤트 발생 페이지 URL */
  url?: string;
  /** 클라이언트 헤더 */
  userAgent?: string | null;
  ip?: string | null;
  /** Meta 사용자 식별 향상용 — _fbp / _fbc 쿠키 값 (있으면) */
  fbp?: string | null;
  fbc?: string | null;
  /** 커스텀 데이터 (예: content_name) */
  customData?: Record<string, unknown>;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Meta CAPI에 conversion 이벤트 전송.
 * 환경변수 미설정 또는 네트워크 실패 시 조용히 무시 (fire-and-forget OK).
 */
export async function sendMetaCAPIEvent(input: CAPIEventInput): Promise<{ ok: boolean; reason?: string }> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { ok: false, reason: "env missing" };
  }

  // PII 해시 처리 — Meta CAPI 정책: email·external_id 소문자 trim 후 SHA-256
  const userData: Record<string, unknown> = {};
  if (input.userEmail) {
    userData.em = [await sha256Hex(input.userEmail.toLowerCase().trim())];
  }
  if (input.userId) {
    userData.external_id = [await sha256Hex(input.userId)];
  }
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.ip) userData.client_ip_address = input.ip;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const body = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.url,
        user_data: userData,
        custom_data: input.customData ?? {},
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // 타임아웃: Node fetch는 기본 타임아웃 없음 → AbortController로 5초
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`[meta-capi] ${input.eventName} failed: ${res.status} ${err.slice(0, 200)}`);
      return { ok: false, reason: `http ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[meta-capi] ${input.eventName} exception:`, e instanceof Error ? e.message : e);
    return { ok: false, reason: "fetch failed" };
  }
}
