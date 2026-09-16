"use client";

// 카카오·구글 OAuth 전용 로그인. 이메일/비밀번호 가입은 2026-04-27 폐지.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PawPrint, Check, Loader2, ExternalLink, AlertCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  detectInAppBrowser,
  detectOS,
  detectSamsungInternet,
  inAppBrowserLabel,
  isProviderBlockedInApp,
  openInExternalBrowser,
  type InAppBrowser,
} from "@/lib/in-app-browser";
import { explainAuthError } from "@/lib/auth-errors";

function logAuthError(payload: {
  provider?: string | null;
  stage?: string;
  error_code?: string | null;
  error_desc?: string | null;
}) {
  try {
    fetch("/api/auth/log-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        url: typeof window !== "undefined" ? window.location.href : null,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* no-op */ }
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [agreed, setAgreed] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"kakao" | "google" | "apple" | null>(null);
  const [error, setError] = useState("");

  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [inApp, setInApp] = useState<InAppBrowser>(null);
  const [isSamsung, setIsSamsung] = useState(false);
  const [showIosCopyHint, setShowIosCopyHint] = useState(false);
  useEffect(() => {
    setInApp(detectInAppBrowser());
    setIsSamsung(detectSamsungInternet());
  }, []);

  const authError = searchParams.get("error");
  const authErrorCode = searchParams.get("error_code");
  const authErrorDesc = searchParams.get("error_description");
  const authProvider = searchParams.get("provider");

  const oauthGuide = (authError || authErrorDesc)
    ? explainAuthError(authErrorCode || authError, authErrorDesc, authProvider)
    : null;

  useEffect(() => {
    if (!authError && !authErrorDesc) return;
    logAuthError({
      provider: authProvider,
      stage: "redirected",
      error_code: authErrorCode || authError,
      error_desc: authErrorDesc,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenExternal = async () => {
    const success = openInExternalBrowser();
    if (!success) {
      try { await navigator.clipboard.writeText(window.location.href); } catch {}
      setShowIosCopyHint(true);
    }
  };

  const handleSocial = async (provider: "kakao" | "google" | "apple") => {
    // 인앱이라도 카카오는 그대로 진행 — 막히는 건 구글·애플뿐이다 (2026-08-09)
    if (isProviderBlockedInApp(provider, inApp)) { handleOpenExternal(); return; }
    if (!agreed) { setError("약관에 동의해주세요."); return; }
    setError("");
    setSocialLoading(provider);

    const rawNext = searchParams.get("next");
    const safeNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
    const callbackUrl = `${window.location.origin}/api/auth/callback?provider=${provider}&next=${encodeURIComponent(safeNext)}`;
    const oauthOptions: { redirectTo: string; scopes?: string } = { redirectTo: callbackUrl };
    if (provider === "kakao") {
      oauthOptions.scopes = "account_email profile_nickname profile_image";
    }
    if (provider === "apple") {
      oauthOptions.scopes = "name email";
    }
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider,
      options: oauthOptions,
    });
    if (oauthError) {
      setSocialLoading(null);
      setError(oauthError.message);
      logAuthError({
        provider,
        stage: "client",
        error_code: "signin_with_oauth_failed",
        error_desc: oauthError.message,
      });
    }
  };

  const guideIconColor =
    oauthGuide?.severity === "danger" ? "var(--color-error)" :
    oauthGuide?.severity === "warn" ? "var(--color-warning)" : "var(--color-text-sub)";

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-12 flex flex-col justify-center max-w-lg mx-auto w-full">
        {/* 인앱 브라우저 경고 */}
        {inApp && (
          <div
            className="mb-6 p-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <div className="flex items-start gap-2.5 mb-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--color-text-sub)" }} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-text-main">
                  카카오로 바로 로그인할 수 있어요
                </p>
                <p className="text-[13px] mt-1 leading-relaxed text-text-sub">
                  {inAppBrowserLabel(inApp)} 안에서는 <b>구글·애플 로그인만</b> 막혀 있어요.
                  그 두 가지를 쓰시려면 아래에서 브라우저를 열어주세요.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="w-full flex items-center justify-center gap-2 h-10 font-semibold text-[13px] transition-transform press-strong"
              style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)", borderRadius: "var(--radius-input)" }}
            >
              <ExternalLink size={14} />
              {detectOS() === "ios" && inApp !== "kakaotalk"
                ? "주소 복사하고 사파리에서 열기"
                : "크롬/사파리에서 열기"}
            </button>
            {showIosCopyHint && (
              <div className="mt-3 pt-3 text-[11px] leading-relaxed text-text-sub" style={{ borderTop: "1px solid var(--color-divider)" }}>
                <p className="font-semibold mb-1 text-text-main">주소가 복사됐어요</p>
                <p>사파리(iOS) 또는 크롬(Android)을 직접 열고 주소창에 붙여넣어주세요.</p>
              </div>
            )}
          </div>
        )}

        {/* 로고 */}
        <div className="text-center mb-8">
          <PawPrint size={40} className="text-primary inline-block mb-4" strokeWidth={1.8} />
          <h1 className="text-[24px] font-bold text-text-main tracking-tight">도시공존</h1>
          <p className="text-[15px] text-text-sub mt-2 leading-relaxed">
            카카오 또는 구글로 1초 만에 시작하기
          </p>
        </div>

        {/* OAuth 에러 가이드 */}
        {oauthGuide && (
          <div
            className="p-4 mb-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="mt-0.5 shrink-0" style={{ color: guideIconColor }} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-text-main">
                  {oauthGuide.title}
                </p>
                <p className="text-[13px] mt-1 leading-relaxed text-text-sub">
                  {oauthGuide.body}
                </p>
                {oauthGuide.tip && (
                  <p className="text-[13px] mt-2 leading-relaxed font-semibold text-text-main">
                    {oauthGuide.tip}
                  </p>
                )}
                {/* 사과 + 자동 접수 안내 — 에러는 logAuthError로 운영팀 로그에 실제 기록됨 */}
                <p className="text-[11px] mt-2 leading-relaxed text-text-light">
                  불편을 드려 죄송해요. 이 오류는 운영팀에 자동으로 접수됐어요.
                  빠른 시일 내에 해결하겠습니다.
                </p>
                {/* 다시 시도 — 에러 쿼리만 제거해 깨끗한 로그인 상태로. next는 보존. */}
                <button
                  type="button"
                  onClick={() => {
                    const next = searchParams.get("next");
                    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? `/login?next=${encodeURIComponent(next)}` : "/login");
                  }}
                  className="mt-3 flex items-center gap-1.5 h-8 px-3 text-[13px] font-semibold press-strong"
                  style={{
                    background: "var(--color-gray-100)",
                    color: "var(--color-text-main)",
                    borderRadius: "var(--radius-input)",
                  }}
                >
                  <RotateCcw size={11} />
                  다시 시도
                </button>
                {(authErrorCode || authError) && (
                  <p className="text-[11px] mt-2 font-mono text-text-light">
                    코드: {authErrorCode || authError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 일반 에러 */}
        {error && (
          <p className="text-[13px] font-semibold mb-4 px-1" style={{ color: "var(--color-error)" }}>{error}</p>
        )}

        {/* 인앱 외 일반 환경에서의 안내 */}
        {!inApp && (
          <p className="mb-4 px-1 text-[13px] text-text-sub leading-relaxed text-center">
            가입과 로그인이 같아요. 처음이시면 카카오 또는 구글 버튼을 눌러주세요.
          </p>
        )}

        {/* 약관 동의 */}
        <div className="mb-4">
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
            <span className="text-[13px] text-text-sub leading-relaxed">
              <Link href="/terms" className="font-bold text-primary underline">이용약관</Link> 및{" "}
              <Link href="/privacy" className="font-bold text-primary underline">개인정보처리방침</Link>에 동의하며, 만 14세 이상입니다
            </span>
          </button>
        </div>

        {/* 삼성 인터넷 경고 */}
        {isSamsung && !inApp && (
          <div className="mb-3 px-1 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--color-warning)" }} />
            <p className="text-[13px] leading-relaxed text-text-sub">
              <b>삼성 인터넷</b>에서는 카카오 로그인이 자주 실패해요 (KOE205).
              <b>크롬·사파리</b>로 열면 안정적이에요.
            </p>
          </div>
        )}

        {/* 소셜 버튼 — 브랜드색(카카오 #FEE500)만 hex 유지, 모서리 8px */}
        <div className="space-y-2.5">
          <button
            onClick={() => handleSocial("kakao")}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-2.5 h-12 text-[15px] font-semibold press-strong transition-transform disabled:opacity-60"
            /* 인앱에서도 카카오는 실제로 진행되므로 약관 동의 상태를 그대로 반영 */
            style={{ backgroundColor: "#FEE500", color: "var(--color-text-main)", borderRadius: "var(--radius-input)", opacity: agreed ? 1 : 0.6 }}
          >
            {socialLoading === "kakao" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M9 1.5C4.582 1.5 1 4.262 1 7.668c0 2.219 1.51 4.166 3.788 5.272-.167.625-.604 2.265-.69 2.617-.108.438.16.43.336.314.138-.092 2.198-1.5 3.083-2.107.49.073.99.111 1.483.111 4.418 0 8-2.762 8-6.207C17 4.262 13.418 1.5 9 1.5z" fill="currentColor" />
              </svg>
            )}
            카카오로 시작하기
          </button>
          <button
            onClick={() => handleSocial("google")}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-2.5 h-12 text-[15px] font-semibold press-strong transition-transform disabled:opacity-60"
            style={{ background: "var(--color-surface)", color: "var(--color-text-main)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-input)", opacity: (agreed || inApp) ? 1 : 0.6 }}
          >
            {socialLoading === "google" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.68-3.86 2.68-6.61z" fill="currentColor" />
                <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" fill="currentColor" />
                <path d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33z" fill="currentColor" />
                <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" fill="currentColor" />
              </svg>
            )}
            Google로 시작하기
          </button>
          <button
            onClick={() => handleSocial("apple")}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-2.5 h-12 text-[15px] font-semibold press-strong transition-transform disabled:opacity-60"
            style={{ background: "var(--color-text-main)", color: "var(--color-surface)", borderRadius: "var(--radius-input)", opacity: (agreed || inApp) ? 1 : 0.6 }}
          >
            {socialLoading === "apple" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true">
                <path d="M13.067 10.667c-.02-2.16 1.76-3.2 1.84-3.253-1.007-1.467-2.567-1.667-3.12-1.693-1.32-.133-2.587.78-3.253.78-.667 0-1.68-.76-2.76-.74-1.413.02-2.72.827-3.447 2.093C.787 10.36 1.72 14.8 3.227 17.12c.747 1.08 1.633 2.293 2.8 2.253 1.12-.04 1.547-.72 2.9-.72 1.347 0 1.733.72 2.907.693 1.213-.02 1.973-1.1 2.72-2.18.853-1.247 1.2-2.453 1.22-2.52-.027-.013-2.34-.893-2.36-3.56l-.347-.42zM10.8 3.293C11.387 2.573 11.8 1.6 11.68.56c-.84.04-1.867.56-2.467 1.267-.54.633-1.013 1.64-.84 2.6.933.073 1.88-.48 2.427-1.133z" fill="currentColor" />
              </svg>
            )}
            Apple로 시작하기
          </button>
        </div>

        <p className="text-[13px] text-text-light text-center mt-6 leading-relaxed">
          한 번 연결하면 다음부터 1클릭 로그인 · 광고 없음 · 무료
        </p>

        {/* 이메일 로그인 */}
        <div className="mt-5 pt-5 border-t border-border">
          <p className="text-[13px] text-text-sub text-center mb-3">이메일로 로그인</p>
          <div className="space-y-2">
            <input
              type="email"
              placeholder="이메일"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              className="w-full px-4 h-12 border border-border text-[15px] outline-none focus:border-primary bg-surface"
              style={{ borderRadius: "var(--radius-input)" }}
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full px-4 h-12 border border-border text-[15px] outline-none focus:border-primary bg-surface"
              style={{ borderRadius: "var(--radius-input)" }}
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
              className="w-full h-12 text-[15px] font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
            >
              {emailLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "로그인"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
