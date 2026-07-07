"use client";

// 카카오·구글 OAuth 전용 가입. 이메일/비밀번호 가입은 2026-04-27 폐지.
// /signup 라우트는 외부 링크 호환성과 가입 컨텍스트(이벤트 응모 등)를 위해 유지.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PawPrint, Check, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  detectInAppBrowser,
  detectOS,
  detectSamsungInternet,
  inAppBrowserLabel,
  openInExternalBrowser,
  type InAppBrowser,
} from "@/lib/in-app-browser";
import TurnstileWidget from "@/app/components/TurnstileWidget";
import { trackPixelEventAsync } from "@/lib/meta-pixel";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event");
  const [agreed, setAgreed] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState<"kakao" | "google" | "apple" | null>(null);
  const [error, setError] = useState("");
  // Cloudflare Turnstile — site key 설정된 환경에서만 활성. 미설정이면 OAuth만 (개발 환경).
  const turnstileRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [inApp, setInApp] = useState<InAppBrowser>(null);
  const [isSamsung, setIsSamsung] = useState(false);
  const [showIosCopyHint, setShowIosCopyHint] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  useEffect(() => {
    setInApp(detectInAppBrowser());
    setIsSamsung(detectSamsungInternet());
    // signup 페이지 진입 시 이전 가입 시도의 잔여 마케팅 동의 의도 클리어.
    // 사용자 A가 가입 도중 cancel하고 사용자 B가 같은 탭에서 가입 시작할 때 데이터 격리.
    try {
      sessionStorage.removeItem("dosigongzon_pending_marketing_consent");
    } catch {
      // sessionStorage 차단 환경 — 무시
    }
  }, []);

  const handleOpenExternal = async () => {
    const success = openInExternalBrowser();
    if (!success) {
      try { await navigator.clipboard.writeText(window.location.href); } catch {}
      setShowIosCopyHint(true);
    }
  };

  const handleSignup = async (provider: "kakao" | "google" | "apple") => {
    if (inApp) { handleOpenExternal(); return; }
    if (!agreed) { setError("약관에 동의해주세요."); return; }
    if (turnstileRequired && !turnstileToken) {
      setError("봇 방지 확인을 완료해주세요.");
      return;
    }
    setError("");
    setLoading(provider);

    // Turnstile 토큰 서버 검증 — 봇·자동화 차단.
    if (turnstileRequired && turnstileToken) {
      try {
        const verifyRes = await fetch("/api/turnstile-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const verifyData = (await verifyRes.json()) as { success: boolean };
        if (!verifyData.success) {
          setError("봇 방지 확인에 실패했어요. 페이지를 새로고침 후 다시 시도해주세요.");
          setLoading(null);
          setTurnstileToken(null);
          return;
        }
      } catch {
        setError("봇 방지 확인 중 오류가 발생했어요. 다시 시도해주세요.");
        setLoading(null);
        return;
      }
    }

    // 마케팅 수신 동의 의도를 sessionStorage에 저장 — OAuth callback 후 MarketingConsentApplier가 처리.
    // 항상 명시적으로 set/remove — 이전 사용자가 남긴 stale 값이 다음 가입자에게 적용되는 사고 방지.
    try {
      if (marketingOptIn) {
        sessionStorage.setItem("dosigongzon_pending_marketing_consent", "1");
      } else {
        sessionStorage.removeItem("dosigongzon_pending_marketing_consent");
      }
    } catch {
      // sessionStorage 차단 환경 — 기능 손실 없이 진행
    }

    const rawNext = searchParams.get("next");
    const safeNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
    const eventQuery = eventParam ? `&event=${encodeURIComponent(eventParam)}` : "";
    const callbackUrl = `${window.location.origin}/api/auth/callback?provider=${provider}&next=${encodeURIComponent(safeNext)}${eventQuery}`;
    const oauthOptions: { redirectTo: string; scopes?: string } = { redirectTo: callbackUrl };
    if (provider === "kakao") {
      oauthOptions.scopes = "account_email profile_nickname profile_image";
    }
    if (provider === "apple") {
      oauthOptions.scopes = "name email";
    }

    // Meta Pixel: 가입 의향 측정 — OAuth로 redirect되기 직전 발사.
    // CompleteRegistration은 가입 성공 후 welcome 페이지에서 발사.
    // Async + grace로 redirect 전 비콘 송신 보장 (race condition 방어).
    await trackPixelEventAsync("Lead", { content_name: `signup_${provider}` });

    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider,
      options: oauthOptions,
    });
    if (oauthError) {
      setLoading(null);
      setError(oauthError.message);
    }
  };

  return (
    <div className="min-h-dvh bg-warm-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-12 flex flex-col justify-center max-w-lg mx-auto w-full">
        {/* 인앱 브라우저 경고 */}
        {inApp && (
          <div
            className="mb-6 rounded-2xl p-4"
            style={{ backgroundColor: "#FBEAEA", border: "1px solid #E8C5C5" }}
          >
            <div className="flex items-start gap-2.5 mb-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0" style={{ color: "#B84545" }} />
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold" style={{ color: "#B84545" }}>
                  {inAppBrowserLabel(inApp)}에서는 가입이 안 돼요
                </p>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#8B2F2F" }}>
                  OAuth 보안 정책으로 인앱 브라우저에서 가입이 차단돼요. 크롬·사파리로 열어주세요.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] text-white active:scale-95"
              style={{ backgroundColor: "#B84545" }}
            >
              <ExternalLink size={14} />
              {detectOS() === "ios" && inApp !== "kakaotalk"
                ? "주소 복사하고 사파리에서 열기"
                : "크롬/사파리에서 열기"}
            </button>
            {showIosCopyHint && (
              <div className="mt-3 rounded-xl p-3 text-[11px] leading-relaxed" style={{ backgroundColor: "#FFF", color: "#6B5043" }}>
                <p className="font-bold mb-1">주소가 복사됐어요 ✓</p>
                <p>사파리(iOS) 또는 크롬(Android)을 열고 주소창에 붙여넣어주세요.</p>
              </div>
            )}
          </div>
        )}

        {/* 로고 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-primary/10 mb-4">
            <PawPrint size={40} className="text-primary" strokeWidth={1.8} />
          </div>
          <h1 className="text-[26px] font-extrabold text-text-main tracking-tight">
            {eventParam === "keyring" ? "이벤트 응모 가입" : "도시공존에 합류하기"}
          </h1>
          <p className="text-[13.5px] text-text-sub mt-2 leading-relaxed">
            카카오 또는 구글로 1초 가입 · 광고 없음 · 무료
          </p>
        </div>

        {/* 이벤트 컨텍스트 */}
        {eventParam === "keyring" && (
          <div
            className="mb-4 rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, #FFF8F2 0%, #FCEFD9 100%)",
              border: "1.5px solid rgba(92,141,238,0.30)",
            }}
          >
            <p className="text-[10.5px] font-extrabold tracking-[0.12em] mb-1.5" style={{ color: "#5C8DEE" }}>
              🎁 1000명 이벤트 응모
            </p>
            <p className="text-[13px] font-extrabold text-text-main leading-tight mb-1">
              가입 후 돌보는 아이 등록 → 응모!
            </p>
            <p className="text-[11.5px] text-text-sub leading-relaxed">
              1,000명 달성 시 추첨으로 20명에게 <b>당신이 돌보는 아이 모양</b>의 커스텀 아크릴 키링을 보내드려요.
            </p>
          </div>
        )}

        {/* 삼성 인터넷 경고 */}
        {isSamsung && !inApp && (
          <div
            className="mb-3 rounded-xl px-3.5 py-2.5 flex items-start gap-2"
            style={{ backgroundColor: "#FFF4E0", border: "1px solid #F5DAB0" }}
          >
            <span className="text-[14px] mt-0.5">⚠️</span>
            <p className="text-[11.5px] leading-relaxed" style={{ color: "#6F4910" }}>
              <b>삼성 인터넷</b>에서는 카카오 가입이 자주 실패해요 (KOE205).
              <b>크롬·사파리</b>로 열면 안정적이에요.
            </p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: "#FBEAEA" }}>
            <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>{error}</p>
          </div>
        )}

        {/* 약관 동의 (필수) */}
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setAgreed(!agreed)}
            className="flex items-start gap-2.5 text-left w-full"
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                agreed ? "bg-primary border-primary" : "border-border"
              }`}
            >
              {agreed && <Check size={12} color="white" strokeWidth={3} />}
            </div>
            <span className="text-[12.5px] text-text-sub leading-relaxed">
              <span className="font-bold text-primary">[필수]</span>{" "}
              <Link href="/terms" className="font-bold text-primary underline">이용약관</Link> 및{" "}
              <Link href="/privacy" className="font-bold text-primary underline">개인정보처리방침</Link>에 동의하며, 만 14세 이상입니다
            </span>
          </button>
        </div>

        {/* 마케팅·이벤트 알림 수신 동의 (선택) — 정보통신망법 §22 개별 명시적 동의 */}
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setMarketingOptIn(!marketingOptIn)}
            className="flex items-start gap-2.5 text-left w-full"
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                marketingOptIn ? "bg-primary border-primary" : "border-border"
              }`}
            >
              {marketingOptIn && <Check size={12} color="white" strokeWidth={3} />}
            </div>
            <span className="text-[12.5px] text-text-sub leading-relaxed">
              <span className="font-bold" style={{ color: "rgba(60,46,35,0.55)" }}>[선택]</span>{" "}
              동네 소식·이벤트·캠페인 안내 푸시 알림 수신에 동의합니다 (마이페이지에서 언제든 끌 수 있어요)
            </span>
          </button>
        </div>

        {/* Cloudflare Turnstile — 봇 방어. site key 없으면 자체적으로 null 렌더 (개발 환경) */}
        {turnstileRequired && (
          <div className="mb-2">
            <TurnstileWidget
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setTurnstileToken(null)}
            />
          </div>
        )}

        {/* 14세 미만 보호자 동의 안내 — 정보통신망법 시행령 §16 */}
        <div className="mb-4 pl-7">
          <p className="text-[10.5px] leading-relaxed" style={{ color: "rgba(60,46,35,0.5)" }}>
            ※ 만 14세 미만은 직접 가입할 수 없어요. 보호자와 함께{" "}
            <a
              href="mailto:grow29971@gmail.com?subject=%5B%EB%8F%84%EC%8B%9C%EA%B3%B5%EC%A1%B4%5D%2014%EC%84%B8%20%EB%AF%B8%EB%A7%8C%20%EA%B0%80%EC%9E%85%20%EC%8B%A0%EC%B2%AD&body=%EB%B3%B4%ED%98%B8%EC%9E%90%20%EC%84%B1%ED%95%A8%3A%0A%EC%9E%90%EB%85%80%20%EB%8B%89%EB%84%A4%EC%9E%84%3A%0A%EC%9E%90%EB%85%80%20%EB%82%98%EC%9D%B4%3A%0A%EC%97%B0%EB%9D%BD%EC%B2%98%3A%0A%0A%E2%96%B2%20%EB%B3%B4%ED%98%B8%EC%9E%90%EB%A1%9C%EC%84%9C%20%EC%9E%90%EB%85%80%EC%9D%98%20%EB%8F%84%EC%8B%9C%EA%B3%B5%EC%A1%B4%20%EA%B0%80%EC%9E%85%EC%97%90%20%EB%8F%99%EC%9D%98%ED%95%A9%EB%8B%88%EB%8B%A4."
              className="underline font-semibold"
              style={{ color: "#8B6FE0" }}
            >
              grow29971@gmail.com
            </a>
            으로 보호자 동의 메일을 보내주세요.
          </p>
        </div>

        {/* 가입 버튼 */}
        <div className="space-y-2.5">
          <button
            onClick={() => handleSignup("kakao")}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[14px] font-extrabold active:scale-[0.97] transition-transform disabled:opacity-60"
            style={{ backgroundColor: "#FEE500", color: "#191919", opacity: (agreed || inApp) ? 1 : 0.6 }}
          >
            {loading === "kakao" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M9 1.5C4.582 1.5 1 4.262 1 7.668c0 2.219 1.51 4.166 3.788 5.272-.167.625-.604 2.265-.69 2.617-.108.438.16.43.336.314.138-.092 2.198-1.5 3.083-2.107.49.073.99.111 1.483.111 4.418 0 8-2.762 8-6.207C17 4.262 13.418 1.5 9 1.5z" fill="#191919" />
              </svg>
            )}
            카카오로 시작하기
          </button>
          <button
            onClick={() => handleSignup("google")}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[14px] font-semibold active:scale-[0.97] transition-transform border border-[#E0E0E0] disabled:opacity-60"
            style={{ backgroundColor: "#FFFFFF", color: "#2A2A28", opacity: (agreed || inApp) ? 1 : 0.6 }}
          >
            {loading === "google" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.68-3.86 2.68-6.61z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853" />
                <path d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33z" fill="#FBBC05" />
                <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
              </svg>
            )}
            Google로 가입하기
          </button>
          <button
            onClick={() => handleSignup("apple")}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[14px] font-semibold active:scale-[0.97] transition-transform disabled:opacity-60"
            style={{ backgroundColor: "#000000", color: "#FFFFFF", opacity: (agreed || inApp) ? 1 : 0.6 }}
          >
            {loading === "apple" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true">
                <path d="M13.067 10.667c-.02-2.16 1.76-3.2 1.84-3.253-1.007-1.467-2.567-1.667-3.12-1.693-1.32-.133-2.587.78-3.253.78-.667 0-1.68-.76-2.76-.74-1.413.02-2.72.827-3.447 2.093C.787 10.36 1.72 14.8 3.227 17.12c.747 1.08 1.633 2.293 2.8 2.253 1.12-.04 1.547-.72 2.9-.72 1.347 0 1.733.72 2.907.693 1.213-.02 1.973-1.1 2.72-2.18.853-1.247 1.2-2.453 1.22-2.52-.027-.013-2.34-.893-2.36-3.56l-.347-.42zM10.8 3.293C11.387 2.573 11.8 1.6 11.68.56c-.84.04-1.867.56-2.467 1.267-.54.633-1.013 1.64-.84 2.6.933.073 1.88-.48 2.427-1.133z" fill="currentColor" />
              </svg>
            )}
            Apple로 시작하기
          </button>
        </div>

        <p className="text-[11.5px] text-text-light text-center mt-6">
          이미 계정이 있으면 같은 방법으로 다시 누르면 로그인돼요.
        </p>

        {/* 이메일 로그인 */}
        <div className="mt-5 pt-5 border-t border-border">
          <p className="text-[12px] text-text-sub text-center mb-3">이메일로 로그인</p>
          <div className="space-y-2">
            <input
              type="email"
              placeholder="이메일"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border text-[14px] outline-none focus:border-primary"
              style={{ backgroundColor: "#fff" }}
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border text-[14px] outline-none focus:border-primary"
              style={{ backgroundColor: "#fff" }}
            />
            <button
              type="button"
              disabled={emailLoading || !emailInput || !passwordInput}
              onClick={async () => {
                setEmailLoading(true);
                setError("");
                const { error: signInError } = await createClient().auth.signInWithPassword({
                  email: emailInput.trim(),
                  password: passwordInput,
                });
                setEmailLoading(false);
                if (signInError) {
                  setError("이메일 또는 비밀번호가 올바르지 않아요.");
                } else {
                  window.location.href = "/";
                }
              }}
              className="w-full py-3 rounded-xl text-[14px] font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: "#5C8DEE" }}
            >
              {emailLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "로그인"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
