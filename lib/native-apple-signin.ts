// ══════════════════════════════════════════
// iOS 앱(city-ios/ WKWebView 셸) 전용 — 네이티브 Sign in with Apple 브릿지
//
// WKWebView 안에서 Apple OAuth 리다이렉트를 돌리면 무한 로딩이 난다(App Store 반려 2.1(a), 2026-07-05).
// 그래서 iOS 앱에서는 Swift가 ASAuthorizationController로 identityToken을 받아 JS로 넘기고,
// 여기서 supabase.auth.signInWithIdToken()으로 세션을 만든 뒤 /api/auth/callback?native=1 로
// 이동해 첫 가입 처리(닉네임·약관 시각·welcome)를 웹과 동일하게 태운다.
//
// Swift 계약 (city-ios/도시공존/ViewController.swift):
//   JS → Swift : window.webkit.messageHandlers.nativeAppleSignIn.postMessage(null)
//   Swift → JS : window.__appleSignInSuccess(identityToken, rawNonce)
//                window.__appleSignInError(message)   // 취소는 "cancel" 포함 문자열
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

type BridgeWindow = Window & {
  webkit?: { messageHandlers?: { nativeAppleSignIn?: { postMessage: (v: null) => void } } };
  __appleSignInSuccess?: (token: string, nonce: string) => void;
  __appleSignInError?: (msg: string) => void;
};

export function hasNativeAppleSignIn(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as BridgeWindow).webkit?.messageHandlers?.nativeAppleSignIn;
}

export class AppleSignInCancelled extends Error {
  constructor() { super("cancelled"); this.name = "AppleSignInCancelled"; }
}

/**
 * 네이티브 시트를 띄우고 세션까지 만든 뒤 서버 콜백으로 이동한다.
 * 성공 시 페이지가 떠나므로 resolve 후 호출부는 할 일이 없다. 취소는 AppleSignInCancelled로 reject.
 */
export function startNativeAppleSignIn(next: string): Promise<void> {
  const w = window as BridgeWindow;
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { delete w.__appleSignInSuccess; delete w.__appleSignInError; };

    w.__appleSignInSuccess = async (token: string, nonce: string) => {
      cleanup();
      try {
        const { error } = await createClient().auth.signInWithIdToken({ provider: "apple", token, nonce });
        if (error) { reject(new Error(error.message)); return; }
        const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
        window.location.href = `/api/auth/callback?provider=apple&native=1&next=${encodeURIComponent(safeNext)}`;
        resolve();
      } catch (e) {
        reject(e instanceof Error ? e : new Error("apple_signin_failed"));
      }
    };
    w.__appleSignInError = (msg: string) => {
      cleanup();
      const m = (msg || "").toLowerCase();
      // ASAuthorizationError.canceled = 1001
      if (m.includes("cancel") || m.includes("1001")) reject(new AppleSignInCancelled());
      else reject(new Error(msg || "apple_signin_failed"));
    };

    try {
      w.webkit!.messageHandlers!.nativeAppleSignIn!.postMessage(null);
    } catch (e) {
      cleanup();
      reject(e instanceof Error ? e : new Error("bridge_unavailable"));
    }
  });
}
