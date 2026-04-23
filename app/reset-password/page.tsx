"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, Eye, EyeOff, Loader2, KeyRound, Check, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; passwordConfirm?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(!!data.session);
      setCheckingSession(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const pwStrength =
    password.length === 0 ? 0
      : password.length < 6 ? 1
      : password.length < 10 ? 2
      : 3;
  const pwColors = ["", "#B84545", "#C47E5A", "#6B8E6F"];
  const pwLabels = ["", "약함", "보통", "강함"];

  const validate = () => {
    const next: typeof errors = {};
    if (!password) next.password = "새 비밀번호를 입력해주세요.";
    else if (password.length < 6) next.password = "비밀번호는 6자 이상이어야 합니다.";
    if (password !== passwordConfirm) next.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setErrors({ general: error.message || "비밀번호 변경에 실패했어요. 잠시 뒤 다시 시도해주세요." });
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-dvh bg-warm-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/login" className="p-2 -ml-2 active:scale-90 transition-transform">
            <ArrowLeft size={24} className="text-text-main" />
          </Link>
          <h1 className="text-[20px] font-extrabold text-text-main">비밀번호 재설정</h1>
        </div>

        {checkingSession ? (
          <div className="py-20 flex justify-center">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : !hasSession ? (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: "#FBEAEA", border: "1px solid #E8C5C5" }}>
            <AlertCircle size={32} className="mx-auto mb-3" style={{ color: "#B84545" }} />
            <p className="text-[15px] font-extrabold mb-2" style={{ color: "#8B2F2F" }}>
              재설정 링크가 만료됐어요
            </p>
            <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#8B2F2F" }}>
              메일 링크는 1시간 동안만 유효해요. 다시 메일을 받아주세요.
            </p>
            <Link
              href="/find-account"
              className="inline-block px-6 py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold"
            >
              비밀번호 찾기로
            </Link>
          </div>
        ) : done ? (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: "#E8ECE5", border: "1px solid #D6DCD2" }}>
            <Check size={32} className="mx-auto mb-3" style={{ color: "#6B8E6F" }} />
            <p className="text-[16px] font-bold text-text-main mb-2">비밀번호가 변경됐어요!</p>
            <p className="text-[13px] text-text-sub leading-relaxed mb-4">
              새 비밀번호로 자동 로그인됐어요. 바로 도시공존을 이용할 수 있어요.
            </p>
            <button
              onClick={() => { router.push("/"); router.refresh(); }}
              className="inline-block px-6 py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold"
            >
              홈으로 가기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-text-sub leading-relaxed">
              새 비밀번호를 입력해주세요. <b>6자 이상</b>으로 설정해주세요.
            </p>

            {errors.general && (
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FBEAEA" }}>
                <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>{errors.general}</p>
              </div>
            )}

            {/* 새 비밀번호 */}
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
                  placeholder="새 비밀번호"
                  className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="shrink-0 p-0.5">
                  {showPw ? <EyeOff size={18} className="text-text-muted" /> : <Eye size={18} className="text-text-muted" />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-error mt-1 ml-1">{errors.password}</p>}

              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((lv) => (
                      <div
                        key={lv}
                        className="h-1 flex-1 rounded-full transition-colors"
                        style={{ backgroundColor: pwStrength >= lv ? pwColors[pwStrength] : "#E5E0D6" }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: pwColors[pwStrength] }}>
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
                  onChange={(e) => { setPasswordConfirm(e.target.value); setErrors((p) => ({ ...p, passwordConfirm: undefined })); }}
                  placeholder="새 비밀번호 확인"
                  className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
                {passwordConfirm && password === passwordConfirm && (
                  <Check size={16} style={{ color: "#6B8E6F" }} />
                )}
              </div>
              {errors.passwordConfirm && <p className="text-[11px] text-error mt-1 ml-1">{errors.passwordConfirm}</p>}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.3)" }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>
          </div>
        )}

        <div className="text-center mt-8">
          <Link href="/login" className="text-[13px] font-bold text-primary">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
