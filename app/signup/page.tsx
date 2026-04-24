"use client";

// 이메일·비밀번호 회원가입은 중단됨 (2026-04-24).
// 이 페이지는 외부 링크 호환성(/signup 경로 유지) + 카카오·구글 안내 용도.
// 가입은 로그인 페이지의 카카오·구글 버튼으로 통일.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState<"kakao" | "google" | null>(null);
  const [error, setError] = useState("");

  const [inApp, setInApp] = useState<InAppBrowser>(null);
  const [isSamsung, setIsSamsung] = useState(false);
  const [showIosCopyHint, setShowIosCopyHint] = useState(false);
  useEffect(() => {
    setInApp(detectInAppBrowser());
    setIsSamsung(detectSamsungInternet());
  }, []);

  const handleOpenExternal = async () => {
    const success = openInExternalBrowser();
    if (!success) {
      try { await navigator.clipboard.writeText(window.location.href); } catch {}
      setShowIosCopyHint(true);
    }
  };

  const handleSignup = async (provider: "kakao" | "google") => {
    if (inApp) { handleOpenExternal(); return; }
    if (!agreed) { setError("약관에 동의해주세요."); return; }
    setError("");
    setLoading(provider);

    const rawNext = searchParams.get("next");
    const safeNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
    const callbackUrl = `${window.location.origin}/api/auth/callback?provider=${provider}&next=${encodeURIComponent(safeNext)}`;
    const oauthOptions: { redirectTo: string; scopes?: string } = { redirectTo: callbackUrl };
    if (provider === "kakao") {
      oauthOptions.scopes = "account_email profile_nickname profile_image";
    }
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-primary/10 mb-4">
            <PawPrint size={40} className="text-primary" strokeWidth={1.8} />
          </div>
          <h1 className="text-[26px] font-extrabold text-text-main tracking-tight">
            도시공존에 합류하기
          </h1>
          <p className="text-[13.5px] text-text-sub mt-2 leading-relaxed">
            카카오 또는 구글 계정으로 1초 가입
          </p>
        </div>

        {/* 이메일 가입 중단 안내 */}
        <div
          className="mb-4 rounded-xl px-3.5 py-3"
          style={{ backgroundColor: "#F6F1EA", border: "1px solid #E5E0D6" }}
        >
          <p className="text-[12px] font-extrabold text-text-main mb-0.5">
            💡 이메일 가입은 지원하지 않아요
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: "#6B5043" }}>
            비밀번호 관리 부담을 줄이고 계정 복구를 쉽게 하기 위해
            카카오·구글 로그인만 제공해요. 한 번 연결하면 다음부터 1클릭 로그인.
          </p>
        </div>

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

        {/* 가입 버튼 */}
        <div className="space-y-2.5">
          {/* 카카오 */}
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
            카카오로 가입하기
          </button>
          {/* 구글 */}
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
        </div>

        {/* 로그인 안내 */}
        <div className="text-center mt-8">
          <span className="text-[13px] text-text-sub">이미 계정이 있으신가요? </span>
          <Link href="/login" className="text-[13px] font-bold text-primary">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
