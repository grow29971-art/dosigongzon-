"use client";

// 1000명 이벤트 — 키링 응모 페이지 (단순화 버전).
// 로그인 가드 → 버튼 클릭 → POST /api/event/keyring → admin 알림.
// 사진·이름·주소 등은 추첨 후 쪽지로 별도 수집.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Gift, Check, Users, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import InviteSection from "@/app/components/InviteSection";

export default function KeyringEventPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [alreadyEntered, setAlreadyEntered] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  // 가입자 수(이벤트 진행률용) — 1000명 달성 시각화
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .then((res: { count: number | null }) => setMemberCount(res.count ?? 0));
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/event/keyring");
    }
  }, [user, authLoading, router]);

  // 이미 응모했는지 확인
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("event_keyring_entries")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then((res: { data: { id: string } | null }) => {
        if (res.data) setAlreadyEntered(true);
      });
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    setError("");
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/event/keyring", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "응모 실패");

      setDone(true);
      toast.success("응모 완료! 추첨 결과를 기다려주세요 🎁");
    } catch (err) {
      setError(err instanceof Error ? err.message : "응모 중 오류 발생");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-3">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <h1 className="text-[18px] font-extrabold text-text-main flex items-center gap-1.5">
          <Gift size={16} style={{ color: "#C47E5A" }} />
          1000명 이벤트 응모
        </h1>
      </div>

      {/* 안내 카드 */}
      <div className="px-4 mt-2 mb-4">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, #FFF8F2 0%, #FCEFD9 100%)",
            border: "1.5px solid rgba(196,126,90,0.25)",
          }}
        >
          <p className="text-[10.5px] font-extrabold tracking-[0.12em] mb-1" style={{ color: "#C47E5A" }}>
            🎁 길고양이 모양 아크릴 키링
          </p>
          <p className="text-[13.5px] font-extrabold text-text-main leading-tight mb-1">
            가입자 1,000명 달성 시 20명 추첨
          </p>
          <p className="text-[11.5px] text-text-sub leading-relaxed">
            아래 버튼 한 번이면 응모 완료. 당첨되시면 쪽지로 키링 디자인용 사진과 배송 정보를 별도로 여쭤볼게요.
          </p>
        </div>
      </div>

      {/* 진행률 — 1000명 목표 시각화 */}
      {memberCount !== null && memberCount < 1000 && (
        <div className="px-4 mb-4">
          <div
            className="rounded-2xl p-4"
            style={{ background: "#FFF", border: "1px solid rgba(196,126,90,0.18)", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={13} style={{ color: "#C47E5A" }} />
                <span className="text-[12px] font-extrabold text-text-main">이벤트 진행도</span>
              </div>
              <span className="text-[11px] font-extrabold" style={{ color: "#C47E5A" }}>
                {memberCount.toLocaleString()} / 1,000명
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ background: "rgba(196,126,90,0.15)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((memberCount / 1000) * 100, 100)}%`,
                  background: "linear-gradient(90deg, #C47E5A 0%, #E88D5A 100%)",
                }}
              />
            </div>
            <p className="text-[10.5px] text-text-sub mt-2 leading-relaxed">
              {1000 - memberCount}명만 더 모이면 추첨이 시작돼요. 친구를 초대하면 더 빨리 달성해요 🎁
            </p>
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="px-4">
        {done || alreadyEntered ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: done ? "#E8ECE5" : "#FFF4E0",
              border: `1px solid ${done ? "#D6DCD2" : "#F5DAB0"}`,
            }}
          >
            {done ? (
              <Check size={36} className="mx-auto mb-3" style={{ color: "#6B8E6F" }} />
            ) : (
              <Gift size={36} className="mx-auto mb-3" style={{ color: "#B07A1C" }} />
            )}
            <p className="text-[16px] font-extrabold text-text-main mb-2">
              {done ? "응모 완료!" : "이미 응모하셨어요"}
            </p>
            <p className="text-[13px] text-text-sub leading-relaxed">
              가입자 1,000명 달성 시 추첨해서 쪽지로 안내드릴게요.
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-3 text-[11.5px]" style={{ color: "#C47E5A" }}>
              <Users size={12} />
              <b>친구를 초대하면 추첨이 더 빨리 시작돼요!</b>
            </div>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold"
            >
              홈으로
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="rounded-xl px-4 py-3" style={{ background: "#FBEAEA" }}>
                <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold disabled:opacity-50 active:scale-[0.97] flex items-center justify-center gap-2"
              style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.30)" }}
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />}
              {submitting ? "응모 중..." : "응모하기"}
            </button>

            <p className="text-[10.5px] text-text-light text-center leading-relaxed pt-2">
              · 한 분당 1회만 응모 가능합니다.<br />
              · 추첨되시면 쪽지로 키링 제작용 사진과 배송 정보를 별도로 여쭤볼게요.
            </p>
          </div>
        )}
      </div>

      {/* 친구 초대 — 이벤트 빨리 끝내기 */}
      <div className="px-4 mt-6">
        <div className="mb-2 flex items-start gap-2">
          <span className="text-[14px]">📣</span>
          <p className="text-[11.5px] text-text-sub leading-relaxed">
            <b className="text-text-main">친구를 초대해주세요.</b> 가입자 1,000명이 빨리 모일수록 추첨이 빨라지고,
            친구가 많으면 동네 길고양이가 더 안전해져요.
          </p>
        </div>
        <InviteSection />
      </div>
    </div>
  );
}
