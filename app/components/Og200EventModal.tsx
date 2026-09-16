"use client";

// "초기 200 길집사" 이벤트 안내 모달.
// 모든 로그인 사용자에게 1회 노출 — localStorage 마킹으로 dismiss.
// 강제 알림 채널 중 가장 강함(DM·푸시 안 본 사람도 다음 진입 시 노출).
//
// 노출 조건:
//  - 로그인 사용자
//  - 미dismiss
//  - 캠페인 종료(6/1 자정) 전까지
// 종료 후 자동 비활성 — 코드 변경 없이 자연 소멸.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

const DISMISS_KEY = "dosigongzon_og200_seen";
// 6/1 정식 출시 자정까지 노출. 이후 모달 자동 비활성(영구 dismiss와 동일 효과).
const CAMPAIGN_END = new Date("2026-06-02T00:00:00+09:00").getTime();

export default function Og200EventModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (Date.now() >= CAMPAIGN_END) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }

    // og_200 보유자에게만 노출 — 운영자 부여 타이틀(official_volunteer 등)
    // 보유자는 더 영예로운 타이틀 보존하므로 모달 노출 안 함.
    let cancelled = false;
    (async () => {
      try {
        const sb = createClient();
        const { data } = await sb
          .from("profiles")
          .select("admin_title")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        const title = (data as { admin_title?: string | null } | null)?.admin_title;
        if (title !== "og_200") return;
        // 첫 진입 약간 지연 — 다른 모달·hydration과 충돌 방지
        setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, 600);
      } catch {
        /* 무시 — 모달 안 띄움 */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="og200-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden relative"
        style={{ background: "var(--color-surface)", borderRadius: "var(--radius-modal)", boxShadow: "var(--shadow-modal)" }}
      >
        {/* 헤더 */}
        <div className="relative px-6 pt-8 pb-5" style={{ borderBottom: "1px solid var(--color-divider)" }}>
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center press-strong"
            aria-label="닫기"
          >
            <X size={18} style={{ color: "var(--color-text-light)" }} />
          </button>

          <Star size={36} strokeWidth={1.6} className="mx-auto mb-3" style={{ color: "var(--color-primary)" }} />
          <p className="text-center text-[11px] font-medium mb-1 text-text-light">
            LIMITED · OFFICIAL LAUNCH
          </p>
          <h2
            id="og200-title"
            className="text-[20px] font-bold text-center tracking-tight leading-tight text-text-main"
          >
            "초기 200" 타이틀이 도착했어요
          </h2>
        </div>

        {/* 본문 */}
        <div className="px-6 pt-5 pb-6">
          <p className="text-[13px] leading-relaxed text-text-main mb-4">
            정식 출시 전, 도시공존에 가장 먼저 합류한
            {" "}초기 멤버에게만 영구 한정 타이틀
            {" "}<b style={{ color: "var(--color-primary)" }}>초기 200</b>이 자동 부여됐어요.
          </p>

          <div className="mb-4 text-[13px] leading-relaxed text-text-sub" style={{ borderTop: "1px solid var(--color-divider)", borderBottom: "1px solid var(--color-divider)", padding: "12px 0" }}>
            <p className="font-semibold mb-1 text-text-main">
              이런 의미예요
            </p>
            <ul className="space-y-1 pl-1">
              <li>· 출시 후 가입한 사람은 절대 받을 수 없어요</li>
              <li>· 마이페이지 타이틀에서 장착할 수 있어요</li>
              <li>· 닉네임 옆에 타이틀로 영구 노출돼요</li>
            </ul>
          </div>

          <p className="text-[13px] leading-relaxed text-text-sub mb-5 text-center">
            처음부터 함께해 주셔서 진심으로 감사드립니다.
            <br /><span className="text-[11px] text-text-light">— 도시공존 운영자 김성우 드림</span>
          </p>

          <div className="flex gap-2">
            <Link
              href="/mypage"
              onClick={dismiss}
              className="flex-[1.4] flex items-center justify-center h-12 text-[15px] font-semibold press"
              style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
            >
              내 타이틀 보러가기
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 h-12 text-[15px] font-semibold press"
              style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)", borderRadius: "var(--radius-input)" }}
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
