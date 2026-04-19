"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PawPrint, Mail, Lock, Eye, EyeOff, Check, ChevronRight, Loader2, ExternalLink, AlertCircle, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  detectInAppBrowser,
  detectOS,
  inAppBrowserLabel,
  openInExternalBrowser,
  type InAppBrowser,
} from "@/lib/in-app-browser";
import { explainAuthError } from "@/lib/auth-errors";

// 로그인 에러를 서버에 로깅 (best-effort, 실패해도 무시)
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

/* ═══ 이메일 유효성 검사 ═══ */
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

/* ═══ 페이지 ═══ */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [keepLogin, setKeepLogin] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [pressing, setPressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [socialAgree, setSocialAgree] = useState(false);

  // 인앱 브라우저 감지 (카톡/페북/인스타 등)
  const [inApp, setInApp] = useState<InAppBrowser>(null);
  const [showIosCopyHint, setShowIosCopyHint] = useState(false);
  useEffect(() => {
    setInApp(detectInAppBrowser());
  }, []);

  const handleOpenExternal = async () => {
    const success = openInExternalBrowser();
    if (!success) {
      // iOS 카톡 외 인앱: URL 복사로 안내
      try {
        await navigator.clipboard.writeText(window.location.href);
      } catch {}
      setShowIosCopyHint(true);
    }
  };

  const authError = searchParams.get("error");
  const authErrorCode = searchParams.get("error_code");
  const authErrorDesc = searchParams.get("error_description");
  const authProvider = searchParams.get("provider");

  // 콜백으로 돌아온 에러를 가이드 객체로 변환
  const oauthGuide = (authError || authErrorDesc)
    ? explainAuthError(authErrorCode || authError, authErrorDesc, authProvider)
    : null;

  // 페이지에 에러 파라미터 들고 돌아왔을 때 한 번 로깅
  // (콜백에서 이미 로깅했지만, 클라이언트 환경 정보가 추가로 필요할 때를 위해)
  useEffect(() => {
    if (!authError && !authErrorDesc) return;
    logAuthError({
      provider: authProvider,
      stage: "redirected",
      error_code: authErrorCode || authError,
      error_desc: authErrorDesc,
    });
    // 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 매직링크
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicSending, setMagicSending] = useState(false);
  const [magicErr, setMagicErr] = useState("");
  const [showMagic, setShowMagic] = useState(false);

  const handleMagicLink = async () => {
    setMagicErr("");
    if (!isValidEmail(magicEmail)) {
      setMagicErr("올바른 이메일을 입력해주세요.");
      return;
    }
    setMagicSending(true);
    const { error } = await createClient().auth.signInWithOtp({
      email: magicEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    setMagicSending(false);
    if (error) {
      setMagicErr(error.message);
      logAuthError({
        provider: "magic_link",
        stage: "client",
        error_code: "otp_failed",
        error_desc: error.message,
      });
      return;
    }
    setMagicSent(true);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!email) next.email = "이메일을 입력해주세요.";
    else if (!isValidEmail(email)) next.email = "올바른 이메일 형식이 아닙니다.";
    if (!password) next.password = "비밀번호를 입력해주세요.";
    else if (password.length < 6) next.password = "비밀번호는 6자 이상이어야 합니다.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // 브루트포스 방어: 5회 실패 시 60초 잠금
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  const handleLogin = async () => {
    if (!validate()) return;

    // 잠금 확인
    if (lockedUntil > Date.now()) {
      const remain = Math.ceil((lockedUntil - Date.now()) / 1000);
      setErrors({ general: `로그인 시도가 너무 많습니다. ${remain}초 후 다시 시도해주세요.` });
      return;
    }

    setLoading(true);
    setErrors({});

    const { error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      const attempts = loginAttempts + 1;
      setLoginAttempts(attempts);

      // 5회 실패 시 60초 잠금
      if (attempts >= 5) {
        setLockedUntil(Date.now() + 60000);
        setLoginAttempts(0);
        setErrors({ general: "로그인 시도가 5회 실패했습니다. 1분 후 다시 시도해주세요." });
        return;
      }

      if (error.message.includes("Invalid login credentials")) {
        setErrors({ general: `이메일 또는 비밀번호가 올바르지 않습니다. (${attempts}/5)` });
      } else if (error.message.includes("Email not confirmed")) {
        setErrors({ general: "이메일 인증을 완료해주세요. 메일함을 확인해주세요." });
      } else {
        setErrors({ general: error.message });
      }
      return;
    }

    setLoginAttempts(0);

    // next 파라미터 있으면 해당 경로로, 없으면 홈
    const rawNext = searchParams.get("next");
    const safeNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
    router.push(safeNext);
    router.refresh();
  };

  const handleSocialLogin = async (provider: "google" | "kakao") => {
    setSocialLoading(provider);
    const rawNext = searchParams.get("next");
    const safeNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
    const callbackUrl = `${window.location.origin}/api/auth/callback?provider=${provider}&next=${encodeURIComponent(safeNext)}`;
    // Kakao 는 account_email 을 개인앱에서 받을 수 없으므로 scope 명시적 지정
    const scopes = provider === "kakao" ? "profile_nickname profile_image" : undefined;
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl,
        scopes,
      },
    });
    if (error) {
      setSocialLoading(null);
      setErrors({ general: error.message });
      logAuthError({
        provider,
        stage: "client",
        error_code: "signin_with_oauth_failed",
        error_desc: error.message,
      });
    }
  };

  return (
    <div className="min-h-dvh bg-warm-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-12 flex flex-col justify-center max-w-lg mx-auto w-full">
        {/* ══════ 인앱 브라우저 경고 (카톡/페북/인스타 등에서 Google OAuth 차단) ══════ */}
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
                  Google 보안 정책으로 인앱 브라우저에서 OAuth가 차단됩니다.
                  일반 브라우저로 열어주세요.
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
              <div
                className="mt-3 rounded-xl p-3 text-[11px] leading-relaxed"
                style={{ backgroundColor: "#FFF", color: "#6B5043" }}
              >
                <p className="font-bold mb-1">주소가 복사됐어요 ✓</p>
                <p>
                  사파리(iOS) 또는 크롬(Android)을 직접 열고 주소창에 붙여넣어주세요.
                  또는 공유 메뉴 → "사파리로 열기"를 이용할 수 있어요.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════ 로고 섹션 ══════ */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-primary/10 mb-4">
            <PawPrint size={40} className="text-primary" strokeWidth={1.8} />
          </div>
          <h1 className="text-[28px] font-extrabold text-text-main tracking-tight">
            도시공존
          </h1>
          <p className="text-[14px] text-text-sub mt-2 leading-relaxed">
            길 위의 생명과 함께 걷는 따뜻한 한 걸음
          </p>
        </div>

        {/* ══════ OAuth 에러 가이드 카드 (redirect 후 돌아왔을 때) ══════ */}
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
                {(authErrorCode || authError) && (
                  <p className="text-[10px] mt-2 font-mono" style={{ color: "#9A8A7A" }}>
                    코드: {authErrorCode || authError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════ 일반 에러 메시지 (비밀번호 로그인 실패 등) ══════ */}
        {errors.general && (
          <div className="rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: "#EEE3DE", border: "1px solid #E3D2CC" }}>
            <p className="text-[13px]" style={{ color: "#B84545" }}>
              {errors.general}
            </p>
          </div>
        )}

        {/* ══════ 입력 폼 ══════ */}
        <div className="space-y-3 mb-4">
          {/* 이메일 */}
          <div>
            <div
              className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 border transition-colors ${
                errors.email ? "border-error" : "border-border focus-within:border-primary"
              }`}
            >
              <Mail size={18} className="text-text-muted shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="이메일"
                className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
              />
            </div>
            {errors.email && (
              <p className="text-[11px] text-error mt-1 ml-1">{errors.email}</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <div
              className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 border transition-colors ${
                errors.password ? "border-error" : "border-border focus-within:border-primary"
              }`}
            >
              <Lock size={18} className="text-text-muted shrink-0" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                placeholder="비밀번호"
                className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="shrink-0 p-0.5"
              >
                {showPw ? (
                  <EyeOff size={18} className="text-text-muted" />
                ) : (
                  <Eye size={18} className="text-text-muted" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-error mt-1 ml-1">{errors.password}</p>
            )}
          </div>
        </div>

        {/* ══════ 로그인 유지 + 비밀번호 찾기 ══════ */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setKeepLogin(!keepLogin)}
            className="flex items-center gap-2"
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                keepLogin ? "bg-primary border-primary" : "border-border"
              }`}
            >
              {keepLogin && <Check size={12} color="white" strokeWidth={3} />}
            </div>
            <span className="text-[13px] text-text-sub">로그인 상태 유지</span>
          </button>
          <Link href="/find-account" className="text-[13px] text-text-sub">
            아이디 · 비밀번호 찾기
          </Link>
        </div>

        {/* ══════ 로그인 버튼 ══════ */}
        <button
          onPointerDown={() => setPressing(true)}
          onPointerUp={() => setPressing(false)}
          onPointerLeave={() => setPressing(false)}
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold transition-transform duration-100 disabled:opacity-60"
          style={{
            transform: pressing ? "scale(0.97)" : "scale(1)",
            boxShadow: pressing
              ? "0 2px 8px rgba(196,126,90,0.2)"
              : "0 6px 20px rgba(196,126,90,0.3)",
          }}
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin mx-auto" />
          ) : (
            "로그인"
          )}
        </button>

        {/* ══════ 구분선 ══════ */}
        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[12px] text-text-muted">또는</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* 소셜 로그인 안내 */}
        <div
          className="mb-3 rounded-xl px-4 py-2.5 flex items-start gap-2"
          style={{ backgroundColor: "#F6F1EA", border: "1px solid #E5E0D6" }}
        >
          <span className="text-[13px] mt-0.5">💡</span>
          <p className="text-[11px] text-text-sub leading-relaxed">
            소셜 로그인은 <b>크롬 · 사파리</b>에서 접속해주세요. 카카오톡/인스타 등 앱 내 브라우저에서는 OAuth가 차단돼요.
          </p>
        </div>

        {/* ══════ 소셜 로그인 약관 동의 ══════ */}
        <div className="mb-4">
          <button
            onClick={() => setSocialAgree(!socialAgree)}
            className="flex items-start gap-2.5"
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                socialAgree ? "bg-primary border-primary" : "border-border"
              }`}
            >
              {socialAgree && <Check size={12} color="white" strokeWidth={3} />}
            </div>
            <span className="text-[12px] text-text-sub text-left leading-relaxed">
              <Link href="/terms" className="font-bold text-primary underline">이용약관</Link> 및{" "}
              <Link href="/privacy" className="font-bold text-primary underline">개인정보처리방침</Link>에 동의하며, 만 14세 이상입니다
            </span>
          </button>
        </div>

        {/* ══════ 소셜 로그인 ══════ */}
        <div className="space-y-2.5">
          {/* 카카오 */}
          <button
            onClick={() => inApp ? handleOpenExternal() : socialAgree ? handleSocialLogin("kakao") : setErrors({ general: "약관에 동의해주세요." })}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[14px] font-semibold active:scale-[0.97] transition-transform disabled:opacity-60"
            style={{ backgroundColor: "#FEE500", color: "#191919", opacity: (socialAgree || inApp) ? 1 : 0.6 }}
          >
            {socialLoading === "kakao" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M9 1C4.58 1 1 3.79 1 7.21c0 2.17 1.45 4.08 3.64 5.18l-.93 3.44c-.08.3.26.54.52.37l4.12-2.74c.21.02.43.03.65.03 4.42 0 8-2.79 8-6.28S13.42 1 9 1z"
                  fill="#191919"
                />
              </svg>
            )}
            카카오로 시작하기
          </button>

          {/* 구글 */}
          <button
            onClick={() => inApp ? handleOpenExternal() : socialAgree ? handleSocialLogin("google") : setErrors({ general: "약관에 동의해주세요." })}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[14px] font-semibold active:scale-[0.97] transition-transform border border-[#E0E0E0] disabled:opacity-60"
            style={{ backgroundColor: "#FFFFFF", color: "#2A2A28", opacity: (socialAgree || inApp) ? 1 : 0.6 }}
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
        </div>

        {/* ══════ 매직링크 (이메일로 로그인 링크 받기) ══════ */}
        <div className="mt-5">
          {!showMagic ? (
            <button
              type="button"
              onClick={() => setShowMagic(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12.5px] font-semibold text-text-sub active:scale-[0.98] transition-transform"
              style={{ backgroundColor: "#F6F1EA", border: "1px dashed #D6CCBF" }}
            >
              <Sparkles size={14} className="text-primary" />
              소셜 로그인이 안 되면 이메일로 로그인 링크 받기
            </button>
          ) : magicSent ? (
            <div
              className="rounded-2xl p-4"
              style={{ backgroundColor: "#E8F4E8", border: "1px solid #C8E0C8" }}
            >
              <p className="text-[13px] font-extrabold" style={{ color: "#3F5B42" }}>
                📨 메일을 보냈어요!
              </p>
              <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#5A7A5E" }}>
                <b>{magicEmail}</b> 메일함을 확인해주세요. 링크를 누르면 바로 로그인돼요.
                <br />스팸함도 확인해보세요.
              </p>
              <button
                type="button"
                onClick={() => { setMagicSent(false); setShowMagic(false); setMagicEmail(""); }}
                className="mt-2 text-[11px] font-bold text-primary"
              >
                다른 이메일로 다시 보내기
              </button>
            </div>
          ) : (
            <div
              className="rounded-2xl p-4"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E0D6" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-primary" />
                <p className="text-[12.5px] font-extrabold text-text-main">
                  이메일 로그인 링크
                </p>
              </div>
              <p className="text-[11px] text-text-sub mb-3 leading-relaxed">
                비밀번호 없이 메일로 받은 링크만 누르면 로그인돼요. 소셜 로그인이 안 될 때 가장 확실한 방법이에요.
              </p>
              <div
                className={`flex items-center gap-2 bg-[#F6F1EA] rounded-xl px-3 py-2.5 border ${
                  magicErr ? "border-error" : "border-border"
                }`}
              >
                <Mail size={15} className="text-text-muted shrink-0" />
                <input
                  type="email"
                  value={magicEmail}
                  onChange={(e) => { setMagicEmail(e.target.value); setMagicErr(""); }}
                  placeholder="이메일 주소"
                  className="flex-1 text-[13px] bg-transparent outline-none placeholder:text-text-muted"
                  onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
                />
              </div>
              {magicErr && (
                <p className="text-[11px] text-error mt-1">{magicErr}</p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => { setShowMagic(false); setMagicErr(""); }}
                  className="px-3 py-2 rounded-xl text-[12px] font-bold text-text-sub"
                  style={{ backgroundColor: "#F6F1EA" }}
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={magicSending}
                  className="flex-1 py-2 rounded-xl text-[12px] font-extrabold text-white active:scale-[0.98] disabled:opacity-60"
                  style={{ backgroundColor: "#C47E5A" }}
                >
                  {magicSending ? (
                    <Loader2 size={14} className="animate-spin mx-auto" />
                  ) : (
                    "로그인 링크 받기"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ══════ 회원가입 링크 ══════ */}
        <div className="text-center mt-8">
          <span className="text-[13px] text-text-sub">아직 계정이 없으신가요? </span>
          <Link
            href="/signup"
            className="text-[13px] font-bold text-primary inline-flex items-center gap-0.5"
          >
            회원가입 <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
