"use client";

// "초기 200 케어테이커" 이벤트 안내 모달.
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
import { Sparkles, X } from "lucide-react";
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
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="og200-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] overflow-hidden relative"
        style={{ background: "#FFFFFF", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
      >
        {/* 헤더 — 그라데이션 */}
        <div
          className="relative px-6 pt-8 pb-6 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #FFE8C2 0%, #FFCFB5 60%, #FFB99B 100%)" }}
        >
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-white/50 active:scale-90"
            aria-label="닫기"
          >
            <X size={15} style={{ color: "#7A4F30" }} />
          </button>

          <div className="absolute top-4 left-5 animate-pulse">
            <Sparkles size={12} style={{ color: "#fff", opacity: 0.7 }} />
          </div>
          <div className="absolute top-14 right-12 animate-pulse" style={{ animationDelay: "0.3s" }}>
            <Sparkles size={10} style={{ color: "#fff", opacity: 0.5 }} />
          </div>
          <div className="absolute bottom-5 right-5 animate-pulse" style={{ animationDelay: "0.6s" }}>
            <Sparkles size={14} style={{ color: "#fff", opacity: 0.6 }} />
          </div>

          <div
            className="w-[68px] h-[68px] mx-auto rounded-full flex items-center justify-center mb-3"
            style={{
              background: "linear-gradient(135deg, #E88D5A 0%, var(--color-primary) 100%)",
              boxShadow: "0 8px 24px rgba(173, 94, 59,0.45)",
            }}
          >
            <span className="text-[34px] leading-none">🌟</span>
          </div>
          <p className="text-center text-[10px] font-extrabold tracking-[0.25em] mb-1" style={{ color: "#8E5430" }}>
            LIMITED · OFFICIAL LAUNCH 🎉
          </p>
          <h2
            id="og200-title"
            className="text-[22px] font-extrabold text-center tracking-tight leading-tight"
            style={{ color: "#5C3A1E" }}
          >
            🎉 "초기 200" 타이틀이 도착했어요
          </h2>
        </div>

        {/* 본문 */}
        <div className="px-6 pt-5 pb-6">
          <p className="text-[13px] leading-relaxed text-text-main mb-4">
            정식 출시 전, 도시공존에 가장 먼저 합류한
            {" "}초기 멤버에게만 영구 한정 타이틀
            {" "}<b style={{ color: "var(--color-primary-dark)" }}>🌟 초기 200</b>이 자동 부여됐어요.
          </p>

          <div
            className="rounded-2xl px-4 py-3 mb-4 text-[11.5px] leading-relaxed"
            style={{ background: "#FFF9EF", color: "#7A5F3F" }}
          >
            <p className="font-extrabold mb-1" style={{ color: "var(--color-primary-dark)" }}>
              💎 이런 의미예요
            </p>
            <ul className="space-y-1 pl-1">
              <li>· 출시 후 가입한 사람은 절대 받을 수 없어요</li>
              <li>· 마이페이지 타이틀에서 장착할 수 있어요</li>
              <li>· 닉네임 옆에 🌟 표시로 영구 노출돼요</li>
            </ul>
          </div>

          <p className="text-[12px] leading-relaxed text-text-sub mb-5 text-center">
            처음부터 함께해 주셔서 진심으로 감사드립니다.
            <br />출시 후에도 한결같이 좋은 서비스 만들겠습니다 🐾
            <br /><span className="text-[10.5px] text-text-light">— 도시공존 운영자 김성우 드림</span>
          </p>

          <div className="flex gap-2">
            <Link
              href="/mypage"
              onClick={dismiss}
              className="flex-[1.4] flex items-center justify-center py-3 rounded-2xl text-white text-[13px] font-extrabold active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                boxShadow: "var(--shadow-primary)",
              }}
            >
              내 타이틀 보러가기
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 py-3 rounded-2xl text-[13px] font-extrabold active:scale-[0.98] bg-white"
              style={{ color: "var(--color-primary-dark)", border: "1.5px solid rgba(173, 94, 59,0.30)" }}
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
