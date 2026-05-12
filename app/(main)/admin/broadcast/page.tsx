// 운영자 → 전체 사용자 일괄 쪽지 발송 (admin 전용)
// 145명 활성화 액션: 환영·재참여·공지 메시지를 코호트별로 발송.
// API: POST /api/admin/broadcast-dm

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Send,
  Megaphone,
  Users as UsersIcon,
  Sparkles,
  Cat as CatIcon,
  Moon,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";

type Cohort = "all" | "founding" | "no_cat" | "dormant";

const COHORT_OPTIONS: Array<{
  id: Cohort;
  label: string;
  description: string;
  Icon: typeof UsersIcon;
  color: string;
}> = [
  {
    id: "all",
    label: "전체 가입자",
    description: "모든 회원에게 발송 (운영자 본인 제외)",
    Icon: UsersIcon,
    color: "#4A7BA8",
  },
  {
    id: "founding",
    label: "창립 멤버",
    description: "5/20 전 가입한 founding_member 타이틀 보유자",
    Icon: Sparkles,
    color: "#C47E5A",
  },
  {
    id: "no_cat",
    label: "첫 등록 미완료",
    description: "가입했지만 고양이 0건 — cold start 대응",
    Icon: CatIcon,
    color: "#E88D5A",
  },
  {
    id: "dormant",
    label: "휴면 (8~30일)",
    description: "최근 미접속자 — 재참여 유도",
    Icon: Moon,
    color: "#9D7AB8",
  },
];

const TEMPLATES: Array<{ label: string; text: string }> = [
  {
    label: "환영 인사 (창립 멤버)",
    text:
      "안녕하세요, 도시공존 운영자입니다 ✨\n\n정식 오픈 전부터 함께해 주셔서 진심으로 감사해요. 어떻게 도시공존을 알게 되셨는지, 어떤 점이 좋고 어려운지 한 줄이라도 답장 주시면 직접 챙길게요.\n\n— 김성우 드림",
  },
  {
    label: "첫 등록 격려",
    text:
      "안녕하세요, 도시공존 운영자입니다.\n\n우리 동네 길고양이를 지도에 한 마리만 등록해 보시면 도시공존이 어떤 도구인지 가장 빠르게 체감하실 수 있어요. 막히는 부분이 있으면 답장 주세요. 바로 도와드릴게요.\n\n— 김성우 드림",
  },
  {
    label: "재참여 (휴면)",
    text:
      "안녕하세요, 한동안 못 뵈었네요.\n\n그 사이 우리 동네에 새 친구들이 등록됐어요. 시간 되실 때 잠깐 들러서 한 번 봐주세요 🐾\n\n— 도시공존 운영자",
  },
];

export default function AdminBroadcastPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [cohort, setCohort] = useState<Cohort>("founding");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    | { ok: boolean; sent: number; failed: number; totalTargets: number; cohort: string }
    | null
  >(null);
  const [error, setError] = useState("");

  useEffect(() => {
    isCurrentUserAdmin()
      .then((isAdmin) => {
        setAuthorized(isAdmin);
        setChecking(false);
        if (!isAdmin) router.replace("/");
      })
      .catch(() => {
        setChecking(false);
        router.replace("/");
      });
  }, [router]);

  const handleSend = async () => {
    if (sending) return;
    if (!message.trim()) {
      setError("메시지를 입력해주세요.");
      return;
    }
    if (message.length > 1000) {
      setError("메시지는 1000자 이내로 작성해주세요.");
      return;
    }
    const cohortLabel = COHORT_OPTIONS.find((c) => c.id === cohort)?.label ?? cohort;
    if (
      !confirm(
        `"${cohortLabel}" 코호트에 다음 메시지를 발송합니다.\n\n${message.slice(0, 120)}${message.length > 120 ? "..." : ""}\n\n진행할까요?`,
      )
    ) {
      return;
    }

    setSending(true);
    setError("");
    setResult(null);

    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/admin/broadcast-dm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ message: message.trim(), cohort }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "발송 실패");
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setSending(false);
    }
  };

  if (checking || !authorized) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="px-4 pt-12 pb-24 max-w-2xl mx-auto"
      style={{ background: "#F7F4EE", minHeight: "100dvh" }}
    >
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="어드민 홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main tracking-tight flex items-center gap-2">
            <Megaphone size={18} className="text-primary" />
            전체 쪽지 발송
          </h1>
          <p className="text-[11.5px] text-text-sub">
            코호트별 일괄 발송 · 도배 trigger 면제 적용됨
          </p>
        </div>
      </div>

      {/* 코호트 선택 */}
      <section className="mb-5">
        <p className="text-[12px] font-extrabold mb-2.5 px-1" style={{ color: "rgba(60,46,35,0.65)" }}>
          1. 대상 코호트
        </p>
        <div className="grid grid-cols-2 gap-2">
          {COHORT_OPTIONS.map((c) => {
            const Icon = c.Icon;
            const selected = cohort === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCohort(c.id)}
                className="text-left rounded-2xl p-3 active:scale-[0.98] transition-transform"
                style={{
                  background: selected ? `${c.color}10` : "#FFFFFF",
                  border: selected ? `1.5px solid ${c.color}` : "1px solid rgba(0,0,0,0.04)",
                  boxShadow: selected
                    ? `0 4px 12px ${c.color}22`
                    : "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} color={c.color} />
                  <span className="text-[12px] font-extrabold" style={{ color: c.color }}>
                    {c.label}
                  </span>
                </div>
                <p className="text-[10.5px] leading-snug" style={{ color: "rgba(60,46,35,0.55)" }}>
                  {c.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 템플릿 */}
      <section className="mb-5">
        <p className="text-[12px] font-extrabold mb-2 px-1" style={{ color: "rgba(60,46,35,0.65)" }}>
          2. 템플릿 (선택)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setMessage(t.text)}
              className="text-[11px] px-3 py-1.5 rounded-full font-semibold active:scale-[0.97]"
              style={{
                background: "rgba(196,126,90,0.10)",
                color: "#A8684A",
                border: "1px solid rgba(196,126,90,0.22)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* 메시지 입력 */}
      <section className="mb-5">
        <p className="text-[12px] font-extrabold mb-2 px-1" style={{ color: "rgba(60,46,35,0.65)" }}>
          3. 메시지 ({message.length}/1000)
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={10}
          maxLength={1000}
          placeholder="안녕하세요, 도시공존 운영자입니다..."
          className="w-full rounded-2xl bg-white p-4 text-[13.5px] leading-relaxed resize-none"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
            color: "#3D2F25",
          }}
        />
      </section>

      {/* 발송 버튼 */}
      <button
        type="button"
        onClick={handleSend}
        disabled={sending || !message.trim()}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white text-[14px] font-extrabold active:scale-[0.98] disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
          boxShadow: "0 6px 18px rgba(196,126,90,0.28)",
        }}
      >
        {sending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Send size={16} />
        )}
        {sending ? "발송 중…" : "발송하기"}
      </button>

      {error && (
        <div
          className="mt-4 rounded-2xl p-4 text-[13px]"
          style={{ background: "#FBEAEA", color: "#B84545" }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          className="mt-4 rounded-2xl p-4 text-[13px]"
          style={{
            background: result.ok ? "#EAF6EC" : "#FFF6E3",
            color: result.ok ? "#2E7D32" : "#7A5F16",
          }}
        >
          <p className="font-extrabold mb-1">
            {result.ok ? "✓ 발송 완료" : "⚠ 일부 실패"}
          </p>
          <p>
            대상 {result.totalTargets}명 · 성공 {result.sent}건 · 실패 {result.failed}건
          </p>
        </div>
      )}

      <p
        className="text-center text-[11px] mt-4"
        style={{ color: "rgba(60,46,35,0.45)" }}
      >
        ⚠ 발송된 쪽지는 회수 불가. 메시지·코호트 다시 한 번 확인 후 발송.
      </p>
    </div>
  );
}
