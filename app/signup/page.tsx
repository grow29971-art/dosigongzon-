"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PawPrint, Mail, Lock, User, Eye, EyeOff, ArrowLeft, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SignupPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pressing, setPressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!nickname.trim()) next.nickname = "닉네임을 입력해주세요.";
    else if (nickname.length < 2) next.nickname = "닉네임은 2자 이상이어야 합니다.";
    if (!email) next.email = "이메일을 입력해주세요.";
    else if (!isValidEmail(email)) next.email = "올바른 이메일 형식이 아닙니다.";
    if (!password) next.password = "비밀번호를 입력해주세요.";
    else if (password.length < 6) next.password = "비밀번호는 6자 이상이어야 합니다.";
    if (password !== passwordConfirm) next.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (!agree) next.agree = "약관에 동의해주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});

    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { nickname },
      },
    });

    if (error) {
      setLoading(false);
      if (error.message.includes("already registered")) {
        setErrors({ email: "이미 가입된 이메일입니다." });
      } else {
        setErrors({ email: error.message });
      }
      return;
    }

    setLoading(false);
    setEmailSent(true);
  };

  const pwStrength =
    password.length === 0
      ? 0
      : password.length < 6
        ? 1
        : password.length < 10
          ? 2
          : 3;
  const pwColors = ["", "#B84545", "#C47E5A", "#6B8E6F"];
  const pwLabels = ["", "약함", "보통", "강함"];

  return (
    <div className="min-h-dvh bg-warm-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full">
        {/* ══════ 헤더 ══════ */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 active:scale-90 transition-transform"
          >
            <ArrowLeft size={24} className="text-text-main" />
          </button>
          <h1 className="text-[20px] font-extrabold text-text-main">회원가입</h1>
        </div>

        {/* ══════ 로고 ══════ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[22px] bg-primary/10 mb-3">
            <PawPrint size={32} className="text-primary" strokeWidth={1.8} />
          </div>
          <p className="text-[14px] text-text-sub leading-relaxed">
            도시공존 멤버가 되어주세요
          </p>
        </div>

        {/* ══════ 이메일 인증 안내 ══════ */}
        {emailSent && (
          <div className="rounded-2xl p-6 text-center mb-6" style={{ backgroundColor: "#E8ECE5", border: "1px solid #D6DCD2" }}>
            <Mail size={32} className="mx-auto mb-3" style={{ color: "#6B8E6F" }} />
            <p className="text-[16px] font-bold text-text-main mb-2">인증 메일을 보냈습니다!</p>
            <p className="text-[13px] text-text-sub leading-relaxed">
              <strong>{email}</strong>로 인증 링크를 보냈어요.<br />
              메일함을 확인하고 링크를 클릭하면 가입이 완료됩니다.
            </p>
            <Link
              href="/login"
              className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold"
            >
              로그인 페이지로
            </Link>
          </div>
        )}

        {/* ══════ 입력 폼 ══════ */}
        {!emailSent && <><div className="space-y-3 mb-6">
          {/* 닉네임 */}
          <div>
            <div
              className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 border transition-colors ${
                errors.nickname ? "border-error" : "border-border focus-within:border-primary"
              }`}
            >
              <User size={18} className="text-text-muted shrink-0" />
              <input
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setErrors((p) => ({ ...p, nickname: "" })); }}
                placeholder="닉네임 (2자 이상)"
                className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
              />
            </div>
            {errors.nickname && <p className="text-[11px] text-error mt-1 ml-1">{errors.nickname}</p>}
          </div>

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
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                placeholder="이메일"
                className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
              />
            </div>
            {errors.email && <p className="text-[11px] text-error mt-1 ml-1">{errors.email}</p>}
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
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
                placeholder="비밀번호 (6자 이상)"
                className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="shrink-0 p-0.5">
                {showPw ? <EyeOff size={18} className="text-text-muted" /> : <Eye size={18} className="text-text-muted" />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-error mt-1 ml-1">{errors.password}</p>}
            {/* 비밀번호 강도 */}
            {password.length > 0 && (
              <div className="flex items-center gap-2 mt-2 ml-1">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className="h-1 flex-1 rounded-full transition-colors"
                      style={{
                        backgroundColor: pwStrength >= level ? pwColors[pwStrength] : "#E5E0D6",
                      }}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-semibold" style={{ color: pwColors[pwStrength] }}>
                  {pwLabels[pwStrength]}
                </span>
              </div>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <div
              className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 border transition-colors ${
                errors.passwordConfirm ? "border-error" : "border-border focus-within:border-primary"
              }`}
            >
              <Lock size={18} className="text-text-muted shrink-0" />
              <input
                type={showPw ? "text" : "password"}
                value={passwordConfirm}
                onChange={(e) => { setPasswordConfirm(e.target.value); setErrors((p) => ({ ...p, passwordConfirm: "" })); }}
                placeholder="비밀번호 확인"
                className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
              />
              {passwordConfirm && password === passwordConfirm && (
                <Check size={18} className="text-[#6B8E6F] shrink-0" />
              )}
            </div>
            {errors.passwordConfirm && <p className="text-[11px] text-error mt-1 ml-1">{errors.passwordConfirm}</p>}
          </div>
        </div>

        {/* ══════ 약관 동의 ══════ */}
        <div className="mb-6">
          <button onClick={() => { setAgree(!agree); setErrors((p) => ({ ...p, agree: "" })); }} className="flex items-start gap-2.5">
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                agree ? "bg-primary border-primary" : errors.agree ? "border-error" : "border-border"
              }`}
            >
              {agree && <Check size={12} color="white" strokeWidth={3} />}
            </div>
            <span className="text-[13px] text-text-sub text-left leading-relaxed">
              <strong className="text-text-main">이용약관</strong> 및{" "}
              <strong className="text-text-main">개인정보처리방침</strong>에 동의합니다
            </span>
          </button>
          {errors.agree && <p className="text-[11px] text-error mt-1 ml-8">{errors.agree}</p>}
        </div>

        {/* ══════ 가입 버튼 ══════ */}
        <button
          onPointerDown={() => setPressing(true)}
          onPointerUp={() => setPressing(false)}
          onPointerLeave={() => setPressing(false)}
          onClick={handleSignup}
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
            "가입하기"
          )}
        </button>

        {/* ══════ 로그인 링크 ══════ */}
        <div className="text-center mt-6 pb-4">
          <span className="text-[13px] text-text-sub">이미 계정이 있으신가요? </span>
          <Link href="/login" className="text-[13px] font-bold text-primary">
            로그인
          </Link>
        </div>
        </>}
      </div>
    </div>
  );
}
