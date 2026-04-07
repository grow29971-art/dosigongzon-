"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PawPrint, Mail, Lock, Eye, EyeOff, Check, ChevronRight } from "lucide-react";

/* ═══ 소셜 로그인 버튼 데이터 ═══ */
const SOCIAL_LOGINS = [
  {
    label: "카카오로 시작하기",
    bg: "#FEE500",
    color: "#191919",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M9 1C4.58 1 1 3.79 1 7.21c0 2.17 1.45 4.08 3.64 5.18l-.93 3.44c-.08.3.26.54.52.37l4.12-2.74c.21.02.43.03.65.03 4.42 0 8-2.79 8-6.28S13.42 1 9 1z"
          fill="#191919"
        />
      </svg>
    ),
  },
  {
    label: "Google로 시작하기",
    bg: "#FFFFFF",
    color: "#2D2D2D",
    border: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.68-3.86 2.68-6.61z" fill="#4285F4" />
        <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853" />
        <path d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33z" fill="#FBBC05" />
        <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
      </svg>
    ),
  },
  {
    label: "Apple로 시작하기",
    bg: "#000000",
    color: "#FFFFFF",
    icon: (
      <svg width="16" height="18" viewBox="0 0 16 18" fill="white">
        <path d="M13.26 9.48c-.02-2.07 1.69-3.06 1.77-3.11-1-1.4-2.5-1.6-3.03-1.62-1.28-.13-2.52.76-3.17.76-.66 0-1.67-.74-2.75-.72A4.05 4.05 0 0 0 2.67 7c-1.45 2.53-.37 6.27 1.04 8.32.7 1 1.52 2.13 2.6 2.09 1.05-.04 1.45-.68 2.72-.68 1.26 0 1.63.68 2.73.65 1.13-.02 1.83-1.02 2.52-2.03a8.83 8.83 0 0 0 1.14-2.35 3.68 3.68 0 0 1-2.16-3.52zM11.2 3.46A3.72 3.72 0 0 0 12.06 0a3.79 3.79 0 0 0-2.45 1.27 3.55 3.55 0 0 0-.88 2.58 3.14 3.14 0 0 0 2.46-1.4z" />
      </svg>
    ),
  },
];

/* ═══ 이메일 유효성 검사 ═══ */
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ═══ 페이지 ═══ */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [keepLogin, setKeepLogin] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [pressing, setPressing] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!email) next.email = "이메일을 입력해주세요.";
    else if (!isValidEmail(email)) next.email = "올바른 이메일 형식이 아닙니다.";
    if (!password) next.password = "비밀번호를 입력해주세요.";
    else if (password.length < 6) next.password = "비밀번호는 6자 이상이어야 합니다.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = () => {
    if (!validate()) return;
    // TODO: 실제 로그인 API 연동
    router.push("/");
  };

  return (
    <div className="min-h-dvh bg-warm-white flex flex-col">
      {/* 키보드가 올라올 때 스크롤 가능하도록 */}
      <div className="flex-1 overflow-y-auto px-6 py-12 flex flex-col justify-center max-w-lg mx-auto w-full">
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
          <button className="text-[13px] text-text-sub">
            비밀번호 찾기
          </button>
        </div>

        {/* ══════ 로그인 버튼 ══════ */}
        <button
          onPointerDown={() => setPressing(true)}
          onPointerUp={() => setPressing(false)}
          onPointerLeave={() => setPressing(false)}
          onClick={handleLogin}
          className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold transition-transform duration-100"
          style={{
            transform: pressing ? "scale(0.97)" : "scale(1)",
            boxShadow: pressing
              ? "0 2px 8px rgba(255,138,101,0.2)"
              : "0 6px 20px rgba(255,138,101,0.35)",
          }}
        >
          로그인
        </button>

        {/* ══════ 구분선 ══════ */}
        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[12px] text-text-muted">또는</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* ══════ 소셜 로그인 ══════ */}
        <div className="space-y-2.5">
          {SOCIAL_LOGINS.map((social) => (
            <button
              key={social.label}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[14px] font-semibold active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: social.bg,
                color: social.color,
                border: social.border ? "1px solid #E0E0E0" : "none",
              }}
            >
              {social.icon}
              {social.label}
            </button>
          ))}
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
