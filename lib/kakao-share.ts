// ══════════════════════════════════════════
// Kakao JavaScript SDK — 공유 전용 래퍼
// Kakao 앱의 JavaScript 키로 동작. 카카오 Maps와 같은 앱이면 같은 키 사용.
// ══════════════════════════════════════════

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share?: {
        sendDefault: (options: KakaoFeedOptions) => void;
      };
    };
  }
}

// Kakao "feed" 템플릿 타입
interface KakaoFeedOptions {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    imageWidth?: number;
    imageHeight?: number;
    link: {
      mobileWebUrl: string;
      webUrl: string;
    };
  };
  buttons?: {
    title: string;
    link: {
      mobileWebUrl: string;
      webUrl: string;
    };
  }[];
}

const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.1/kakao.min.js";
const SDK_INTEGRITY = "sha384-kYPsUbBPlktXsY6/oNHSUDZoTX6+YI51f63jCPEIPFP09ttByAdxd2mEjKuhdqn4";

let loadPromise: Promise<boolean> | null = null;

function loadSdk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Kakao) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-kakao-share-sdk="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(!!window.Kakao));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.integrity = SDK_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.dataset.kakaoShareSdk = "true";
    script.onload = () => resolve(!!window.Kakao);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return loadPromise;
}

function getKey(): string | null {
  // JavaScript 전용 키가 있으면 그걸 우선, 없으면 Maps 키로 폴백
  const k =
    process.env.NEXT_PUBLIC_KAKAO_JS_KEY ||
    process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ||
    "";
  return k || null;
}

/**
 * SDK 로드 + init 완료 확인. 실패 시 false.
 */
export async function ensureKakaoReady(): Promise<boolean> {
  const ok = await loadSdk();
  if (!ok || !window.Kakao) return false;
  const key = getKey();
  if (!key) return false;
  if (!window.Kakao.isInitialized()) {
    try {
      window.Kakao.init(key);
    } catch {
      return false;
    }
  }
  return !!window.Kakao.Share;
}

export interface ShareInput {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  buttonText?: string; // 기본: "도시공존에서 보기"
}

/**
 * 카카오톡 공유. 실패 시 false 반환 → 호출자가 폴백 처리.
 */
export async function shareToKakao(input: ShareInput): Promise<boolean> {
  const ready = await ensureKakaoReady();
  if (!ready || !window.Kakao?.Share) return false;

  try {
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: input.title.slice(0, 200),
        description: input.description.slice(0, 200),
        imageUrl: input.imageUrl,
        imageWidth: 1200,
        imageHeight: 630,
        link: {
          mobileWebUrl: input.url,
          webUrl: input.url,
        },
      },
      buttons: [
        {
          title: input.buttonText ?? "도시공존에서 보기",
          link: {
            mobileWebUrl: input.url,
            webUrl: input.url,
          },
        },
      ],
    });
    return true;
  } catch (err) {
    console.error("[kakao-share] sendDefault failed:", err);
    return false;
  }
}
