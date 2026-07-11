"use client";

// 카카오·구글 OAuth 전용 로그인. 이메일/비밀번호 가입은 2026-04-27 폐지.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PawPrint, Check, Loader2, ExternalLink, AlertCircle, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  detectInAppBrowser,
  detectOS,
  detectSamsungInternet,
  inAppBrowserLabel,
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
    if (inApp) { handleOpenExternal(); return; }
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
                  {inAppBrowserLabel(inApp)} 안에서는 소셜 로그인이 안 돼요
                </p>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#8B2F2F" }}>
                  보안 정책으로 인앱 브라우저에서 OAuth가 차단됩니다. 일반 브라우저로 열어주세요.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] text-white transition-transform active:scale-95"
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
                <p>사파리(iOS) 또는 크롬(Android)을 직접 열고 주소창에 붙여넣어주세요.</p>
              </div>
            )}
          </div>
        )}

        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <PawPrint size={40} className="text-primary" strokeWidth={1.8} />
          </div>
          <h1 className="text-[26px] font-extrabold text-text-main tracking-tight">도시공존</h1>
          <p className="text-[13.5px] text-text-sub mt-2 leading-relaxed">
            카카오 또는 구글로 1초 만에 시작하기
          </p>
        </div>

        {/* OAuth 에러 가이드 */}
        {oauthGuide && (
          <div
            className="rounded-2xl p-4 mb-4"
            style={{
              backgroundColor:
                oauthGuide.severity === "danger" ? "#FBEAEA" :
                oauthGuide.severity === "warn" ? "#FFF4E0" : "#F0F6FF",
              border: `1px solid ${
                oauthGuide.severity === "danger" ? "#E8C5C5" :
                oauthGuide.severity === "warn" ? "#F5DAB0" : "#C9DBF5"
              }`,
            }}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
                style={{
                  color:
                    oauthGuide.severity === "danger" ? "#B84545" :
                    oauthGuide.severity === "warn" ? "#B07A1C" : "#3A6CB5",
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold" style={{
                  color:
                    oauthGuide.severity === "danger" ? "#8B2F2F" :
                    oauthGuide.severity === "warn" ? "#6F4910" : "#22457A",
                }}>
                  {oauthGuide.title}
                </p>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#5A5A5A" }}>
                  {oauthGuide.body}
                </p>
                {oauthGuide.tip && (
                  <p className="text-[11.5px] mt-2 leading-relaxed font-semibold" style={{ color: "#3F5B42" }}>
                    💡 {oauthGuide.tip}
                  </p>
                )}
                {/* 다시 시도 — 에러 쿼리만 제거해 깨끗한 로그인 상태로. next는 보존. */}
                <button
                  type="button"
                  onClick={() => {
                    const next = searchParams.get("next");
                    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? `/login?next=${encodeURIComponent(next)}` : "/login");
                  }}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold active:scale-95"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.7)",
                    color:
                      oauthGuide.severity === "danger" ? "#8B2F2F" :
                      oauthGuide.severity === "warn" ? "#6F4910" : "#22457A",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <RotateCcw size={11} />
                  다시 시도
                </button>
                {(authErrorCode || authError) && (
                  <p className="text-[10px] mt-2 font-mono" style={{ color: "#9A8A7A" }}>
                    코드: {authErrorCode || authError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 일반 에러 */}
        {error && (
          <div className="rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: "#FBEAEA" }}>
            <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>{error}</p>
          </div>
        )}

        {/* 인앱 외 일반 환경에서의 안내 */}
        {!inApp && (
          <div
            className="mb-4 rounded-xl px-4 py-2.5 flex items-start gap-2"
            style={{ backgroundColor: "#F6F1EA", border: "1px solid #E5E0D6" }}
          >
            <span className="text-[13px] mt-0.5">💡</span>
            <p className="text-[11.5px] text-text-sub leading-relaxed">
              가입과 로그인이 같아요. 처음이시면 그냥 카카오 또는 구글 버튼을 눌러주세요.
            </p>
          </div>
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
            <span className="text-[12.5px] text-text-sub leading-relaxed">
              <Link href="/terms" className="font-bold text-primary underline">이용약관</Link> 및{" "}
              <Link href="/privacy" className="font-bold text-primary underline">개인정보처리방침</Link>에 동의하며, 만 14세 이상입니다
            </span>
          </button>
        </div>

        {/* 삼성 인터넷 경고 */}
        {isSamsung && !inApp && (
          <div
            className="mb-3 rounded-xl px-3.5 py-2.5 flex items-start gap-2"
            style={{ backgroundColor: "#FFF4E0", border: "1px solid #F5DAB0" }}
          >
            <span className="text-[14px] mt-0.5">⚠️</span>
            <p className="text-[11.5px] leading-relaxed" style={{ color: "#6F4910" }}>
              <b>삼성 인터넷</b>에서는 카카오 로그인이 자주 실패해요 (KOE205).
              <b>크롬·사파리</b>로 열면 안정적이에요.
            </p>
          </div>
        )}

        {/* 소셜 버튼 */}
        <div className="space-y-2.5">
          <button
            onClick={() => handleSocial("kakao")}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[14px] font-extrabold active:scale-[0.97] transition-transform disabled:opacity-60"
            style={{ backgroundColor: "#FEE500", color: "#191919", opacity: (agreed || inApp) ? 1 : 0.6 }}
          >
            {socialLoading === "kakao" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M9 1.5C4.582 1.5 1 4.262 1 7.668c0 2.219 1.51 4.166 3.788 5.272-.167.625-.604 2.265-.69 2.617-.108.438.16.43.336.314.138-.092 2.198-1.5 3.083-2.107.49.073.99.111 1.483.111 4.418 0 8-2.762 8-6.207C17 4.262 13.418 1.5 9 1.5z" fill="#191919" />
              </svg>
            )}
            카카오로 시작하기
          </button>
          <button
            onClick={() => handleSocial("google")}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[14px] font-semibold active:scale-[0.97] transition-transform border border-[#E0E0E0] disabled:opacity-60"
            style={{ backgroundColor: "#FFFFFF", color: "#2A2A28", opacity: (agreed || inApp) ? 1 : 0.6 }}
          >
            {socialLoading === "google" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.68-3.86 2.68-6.61z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853" />
                <path d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33z" fill="#FBBC05" />
                <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
              </svg>
            )}
            Google로 시작하기
          </button>
          <button
            onClick={() => handleSocial("apple")}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[14px] font-semibold active:scale-[0.97] transition-transform disabled:opacity-60"
            style={{ backgroundColor: "#000000", color: "#FFFFFF", opacity: (agreed || inApp) ? 1 : 0.6 }}
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

        <p className="text-[11.5px] text-text-light text-center mt-6 leading-relaxed">
          한 번 연결하면 다음부터 1클릭 로그인 ·<br />
          광고 없음 · 무료
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
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {emailLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "로그인"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
