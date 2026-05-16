// Meta Pixel (Facebook Pixel) 헬퍼.
// 동의 후 ConsentManager가 fbq base code를 로드 → 그 다음부터 trackEvent 사용 가능.
// env에 따옴표·\n 들어간 케이스 방어 ([[project-dosigongzon-env-trim]]).

const RAW_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// .env 오염 방어: trim + 양쪽 따옴표 제거
export const META_PIXEL_ID =
  (RAW_PIXEL_ID || "").trim().replace(/^["']|["']$/g, "") || null;

type FbqStandardEvent =
  | "PageView"
  | "Lead"
  | "CompleteRegistration"
  | "ViewContent"
  | "Search"
  | "Contact"
  | "Subscribe";

declare global {
  interface Window {
    fbq?: (
      command: "track" | "trackCustom" | "init",
      eventName: string,
      params?: Record<string, unknown>,
    ) => void;
  }
}

/**
 * fbq가 로드될 때까지 polling 대기. 최대 maxWaitMs 후 timeout.
 * 동의 직후·스크립트 로드 중인 짧은 시간 윈도우에서 silent drop 방지.
 */
function whenFbqReady(maxWaitMs = 2000): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.fbq) return Promise.resolve(true);

  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (window.fbq) return resolve(true);
      if (Date.now() - start >= maxWaitMs) return resolve(false);
      setTimeout(tick, 80);
    };
    tick();
  });
}

/**
 * Meta Pixel 표준 이벤트 발사. 픽셀이 로드 안 됐거나 동의 안 했으면 조용히 무시.
 */
export function trackPixelEvent(
  event: FbqStandardEvent,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!window.fbq) return;
  try {
    window.fbq("track", event, params);
  } catch {
    // 광고 차단·iOS 환경 차단 시 무시
  }
}

/**
 * fbq 로드까지 대기 후 발사 + 비콘 송신 완료 대기. 페이지 unload 직전(OAuth redirect 등)에 안전.
 * @param graceMs 발사 후 비콘 전송을 위해 대기할 시간 (default 250ms)
 */
export async function trackPixelEventAsync(
  event: FbqStandardEvent,
  params?: Record<string, unknown>,
  graceMs = 250,
): Promise<void> {
  const ready = await whenFbqReady();
  if (!ready) return;
  try {
    window.fbq!("track", event, params);
  } catch {
    return;
  }
  // fbq는 내부적으로 img 픽셀로 전송 — 페이지 unload 전 송신 완료를 위해 grace
  await new Promise((r) => setTimeout(r, graceMs));
}

/**
 * 커스텀 이벤트 발사 (도시공존 도메인 — 첫 cat 등록, 첫 돌봄 등).
 */
export function trackPixelCustom(
  eventName: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!window.fbq) return;
  try {
    window.fbq("trackCustom", eventName, params);
  } catch {
    // ignore
  }
}

/**
 * localStorage dedup으로 1회만 발사. fbq 로드 대기 후 발사하므로
 * mount 직후 fbq 미준비 상태여도 drop 안 됨.
 * fbq 발사 성공 후에만 dedup 마킹 — fbq timeout 시 다음 방문에 재시도 가능.
 */
export function trackPixelOnce(
  storageKey: string,
  event: FbqStandardEvent,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(storageKey)) return;
  } catch {
    // localStorage 차단 — dedup 없이 진행
  }
  // fbq 로드 대기 후 발사 — fire-and-forget
  void whenFbqReady().then((ready) => {
    if (!ready) return;
    try {
      window.fbq!("track", event, params);
      try {
        localStorage.setItem(storageKey, "1");
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  });
}
