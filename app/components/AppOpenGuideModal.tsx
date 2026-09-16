"use client";

// 앱 열 때마다(세션 1회) 뜨는 안내 모달. (HomeAuthed, 로그인 유저)
//  - "오늘 이거 해보세요": 다음 행동 추천 (신규=동네설정/첫응원, 기존=기능 순환 강조)
//  - "이런 기능 있어요": 기능 칩으로 빠른 탐색
// localStorage에 마지막 노출 날짜(KST) 저장 → 하루 1회만. 날짜 바뀌면 다시 + 강조 기능 순환.

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ChevronRight, BookOpen, Heart, Trophy, Bot, MessagesSquare, Map, PawPrint, type LucideIcon } from "lucide-react";

const LAST_KEY = "dg_open_guide_last"; // 마지막 노출 날짜(KST) — 하루 1회 게이트
const IDX_KEY = "dg_open_guide_idx"; // 강조 기능 순환 인덱스

interface Spot {
  Icon: LucideIcon;
  title: string;
  desc: string;
  cta: string;
  href: string;
}

// 기존 유저용 — 접속마다 순환 강조
const ROTATION: Spot[] = [
  { Icon: BookOpen, title: "우리 동네 고양이 도감", desc: "내가 만난 고양이를 모아보세요. 완성도가 채워져요.", cta: "도감 열기", href: "/collection" },
  { Icon: Heart, title: "오늘의 안부 한 줄", desc: "우리 동네 고양이에게 돌봄 기록을 남겨봐요.", cta: "지도 열기", href: "/map" },
  { Icon: Trophy, title: "이번 주 돌봄왕", desc: "길집사 랭킹에 도전해보세요.", cta: "랭킹 보기", href: "/ranking" },
  { Icon: Bot, title: "AI집사에게 물어보기", desc: "돌봄·건강 궁금증을 바로 해결해드려요.", cta: "질문하기", href: "/tips" },
  { Icon: MessagesSquare, title: "동네 커뮤니티", desc: "입양·임보·자유 이야기를 나눠요.", cta: "둘러보기", href: "/community" },
];

const CHIPS: { Icon: LucideIcon; label: string; href: string }[] = [
  { Icon: Map, label: "지도", href: "/map" },
  { Icon: BookOpen, label: "도감", href: "/collection" },
  { Icon: Bot, label: "AI집사", href: "/tips" },
  { Icon: Trophy, label: "랭킹", href: "/ranking" },
  { Icon: MessagesSquare, label: "커뮤니티", href: "/community" },
];

export default function AppOpenGuideModal({ hasCat, hasRegion }: { hasCat: boolean; hasRegion: boolean }) {
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);

  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    try {
      if (localStorage.getItem(LAST_KEY) === today) return; // 오늘 이미 봄
    } catch {
      return;
    }

    // "오늘 이거 해보세요" 결정 — 신규는 다음 행동, 기존은 순환 강조
    let chosen: Spot;
    if (!hasRegion) {
      chosen = { Icon: Map, title: "우리 동네부터 정해요", desc: "활동 지역을 설정하면 동네 고양이·소식이 모여요.", cta: "동네 설정하기", href: "/mypage/activity-regions" };
    } else if (!hasCat) {
      chosen = { Icon: PawPrint, title: "동네 고양이에게 첫 응원", desc: "하트 한 번이 가장 쉬운 첫 참여예요.", cta: "지도 열기", href: "/map" };
    } else {
      let idx = 0;
      try {
        idx = Number(localStorage.getItem(IDX_KEY) ?? "0") % ROTATION.length;
        localStorage.setItem(IDX_KEY, String((idx + 1) % ROTATION.length));
      } catch { /* ignore */ }
      chosen = ROTATION[idx];
    }
    setSpot(chosen);

    // 다른 모달(Og200 등)과 안 겹치게 약간 지연
    const t = setTimeout(() => {
      setOpen(true);
      try { localStorage.setItem(LAST_KEY, today); } catch { /* ignore */ }
    }, 900);
    return () => clearTimeout(t);
  }, [hasCat, hasRegion]);

  if (!open || !spot) return null;

  const close = () => setOpen(false);

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden relative"
        style={{ background: "var(--color-surface)", borderRadius: "var(--radius-modal)", boxShadow: "var(--shadow-modal)" }}
      >
        {/* 헤더 */}
        <div className="relative px-6 pt-7 pb-5" style={{ borderBottom: "1px solid var(--color-divider)" }}>
          <button
            type="button"
            onClick={close}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center press-strong"
            aria-label="닫기"
          >
            <X size={18} style={{ color: "var(--color-text-light)" }} />
          </button>
          <p className="text-[11px] font-medium mb-2 text-text-light">오늘 이거 해보세요</p>
          <div className="flex items-center gap-3">
            <spot.Icon size={28} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--color-text-main)" }} />
            <div className="min-w-0">
              <p className="text-[17px] font-bold text-text-main leading-tight tracking-tight">{spot.title}</p>
              <p className="text-[13px] text-text-sub mt-1 leading-snug">{spot.desc}</p>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-6 pt-5 pb-6">
          <Link
            href={spot.href}
            onClick={close}
            className="flex items-center justify-center gap-1.5 h-12 text-[15px] font-semibold press transition-transform"
            style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
          >
            {spot.cta} <ChevronRight size={15} />
          </Link>

          <p className="text-[11px] font-medium mt-5 mb-2.5 text-text-light">이런 기능도 있어요</p>
          <div className="grid grid-cols-3 gap-2">
            {CHIPS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                onClick={close}
                className="flex flex-col items-center gap-1 py-2.5 press-strong transition-transform"
                style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card-sm)" }}
              >
                <c.Icon size={20} strokeWidth={1.8} style={{ color: "var(--color-text-sub)" }} />
                <span className="text-[11px] font-medium text-text-sub">{c.label}</span>
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={close}
            className="w-full mt-4 text-[13px] font-medium text-text-sub py-1.5"
          >
            오늘은 그냥 둘러볼게요
          </button>
        </div>
      </div>
    </div>
  );
}
