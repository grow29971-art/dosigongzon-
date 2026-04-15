"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, User, Loader2, Search, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Tab = "email" | "password";

export default function FindAccountPage() {
  const [tab, setTab] = useState<Tab>("email");

  // 아이디 찾기
  const [nickname, setNickname] = useState("");
  const [foundEmail, setFoundEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // 비밀번호 찾기
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleFindEmail = async () => {
    if (!nickname.trim()) return setEmailError("닉네임을 입력해주세요.");
    setEmailError("");
    setFoundEmail("");
    setEmailLoading(true);

    try {
      const res = await fetch("/api/find-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFoundEmail(data.email);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "조회에 실패했어요.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) return setResetError("이메일을 입력해주세요.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) return setResetError("올바른 이메일 형식이 아닙니다.");
    setResetError("");
    setResetLoading(true);

    try {
      const { error } = await createClient().auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "전송에 실패했어요.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-warm-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/login" className="p-2 -ml-2 active:scale-90 transition-transform">
            <ArrowLeft size={24} className="text-text-main" />
          </Link>
          <h1 className="text-[20px] font-extrabold text-text-main">계정 찾기</h1>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "email" as Tab, label: "아이디 찾기", icon: Search },
            { key: "password" as Tab, label: "비밀번호 찾기", icon: KeyRound },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[13px] font-bold transition-all active:scale-[0.97]"
              style={{
                backgroundColor: tab === t.key ? "#C47E5A" : "#F5F3EE",
                color: tab === t.key ? "#fff" : "#A38E7A",
              }}
            >
              <t.icon size={15} strokeWidth={2.2} />
              {t.label}
            </button>
          ))}
        </div>

        {/* 아이디 찾기 */}
        {tab === "email" && (
          <div className="space-y-4">
            <p className="text-[13px] text-text-sub leading-relaxed">
              가입 시 사용한 <b>닉네임</b>을 입력하면 가입된 이메일을 확인할 수 있어요.
            </p>

            <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 border border-border focus-within:border-primary transition-colors">
              <User size={18} className="text-text-muted shrink-0" />
              <input
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setEmailError(""); setFoundEmail(""); }}
                placeholder="닉네임"
                className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
                onKeyDown={(e) => e.key === "Enter" && handleFindEmail()}
              />
            </div>

            {emailError && (
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FBEAEA" }}>
                <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>{emailError}</p>
              </div>
            )}

            {foundEmail && (
              <div className="rounded-xl px-4 py-4" style={{ backgroundColor: "#E8ECE5", border: "1px solid #D6DCD2" }}>
                <p className="text-[11px] text-text-sub mb-1">가입된 이메일</p>
                <p className="text-[16px] font-bold text-text-main tracking-wide">{foundEmail}</p>
              </div>
            )}

            <button
              onClick={handleFindEmail}
              disabled={emailLoading}
              className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.3)" }}
            >
              {emailLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {emailLoading ? "조회 중..." : "아이디 찾기"}
            </button>
          </div>
        )}

        {/* 비밀번호 찾기 */}
        {tab === "password" && (
          <div className="space-y-4">
            {resetSent ? (
              <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: "#E8ECE5", border: "1px solid #D6DCD2" }}>
                <Mail size={32} className="mx-auto mb-3" style={{ color: "#6B8E6F" }} />
                <p className="text-[16px] font-bold text-text-main mb-2">재설정 메일을 보냈어요!</p>
                <p className="text-[13px] text-text-sub leading-relaxed">
                  <strong>{resetEmail}</strong>로 비밀번호 재설정 링크를 보냈어요.<br />
                  메일함을 확인해주세요.
                </p>
                <Link
                  href="/login"
                  className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold"
                >
                  로그인으로 돌아가기
                </Link>
              </div>
            ) : (
              <>
                <p className="text-[13px] text-text-sub leading-relaxed">
                  가입한 <b>이메일</b>을 입력하면 비밀번호 재설정 링크를 보내드려요.
                </p>

                <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 border border-border focus-within:border-primary transition-colors">
                  <Mail size={18} className="text-text-muted shrink-0" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => { setResetEmail(e.target.value); setResetError(""); }}
                    placeholder="이메일"
                    className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
                    onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                  />
                </div>

                {resetError && (
                  <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FBEAEA" }}>
                    <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>{resetError}</p>
                  </div>
                )}

                <button
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.3)" }}
                >
                  {resetLoading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                  {resetLoading ? "전송 중..." : "재설정 메일 보내기"}
                </button>
              </>
            )}
          </div>
        )}

        {/* 하단 링크 */}
        <div className="text-center mt-8">
          <Link href="/login" className="text-[13px] font-bold text-primary">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
