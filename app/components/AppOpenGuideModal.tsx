"use client";

// 앱 열 때마다(세션 1회) 뜨는 안내 모달. (HomeAuthed, 로그인 유저)
//  - "오늘 이거 해보세요": 다음 행동 추천 (신규=동네설정/첫응원, 기존=기능 순환 강조)
//  - "이런 기능 있어요": 기능 칩으로 빠른 탐색
// localStorage에 마지막 노출 날짜(KST) 저장 → 하루 1회만. 날짜 바뀌면 다시 + 강조 기능 순환.

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ChevronRight } from "lucide-react";

const LAST_KEY = "dg_open_guide_last"; // 마지막 노출 날짜(KST) — 하루 1회 게이트
const IDX_KEY = "dg_open_guide_idx"; // 강조 기능 순환 인덱스

interface Spot {
  emoji: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
}

// 기존 유저용 — 접속마다 순환 강조
const ROTATION: Spot[] = [
  { emoji: "📖", title: "우리 동네 고양이 도감", desc: "내가 만난 고양이를 모아보세요. 완성도가 채워져요.", cta: "도감 열기", href: "/collection" },
  { emoji: "❤️", title: "오늘의 안부 한 줄", desc: "우리 동네 고양이에게 돌봄 기록을 남겨봐요.", cta: "지도 열기", href: "/map" },
  { emoji: "🏆", title: "이번 주 돌봄왕", desc: "케어테이커 랭킹에 도전해보세요.", cta: "랭킹 보기", href: "/ranking" },
  { emoji: "🤖", title: "AI집사에게 물어보기", desc: "돌봄·건강 궁금증을 바로 해결해드려요.", cta: "질문하기", href: "/lab/cat-style" },
  { emoji: "💬", title: "동네 커뮤니티", desc: "입양·임보·자유 이야기를 나눠요.", cta: "둘러보기", href: "/community" },
];

const CHIPS = [
  { emoji: "🗺️", label: "지도", href: "/map" },
  { emoji: "📖", label: "도감", href: "/collection" },
  { emoji: "🤖", label: "AI집사", href: "/lab/cat-style" },
  { emoji: "🏆", label: "랭킹", href: "/ranking" },
  { emoji: "💬", label: "커뮤니티", href: "/community" },
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
      chosen = { emoji: "🗺️", title: "우리 동네부터 정해요", desc: "활동 지역을 설정하면 동네 고양이·소식이 모여요.", cta: "동네 설정하기", href: "/mypage/activity-regions" };
    } else if (!hasCat) {
      chosen = { emoji: "🐾", title: "동네 고양이에게 첫 응원", desc: "하트 한 번이 가장 쉬운 첫 참여예요.", cta: "지도 열기", href: "/map" };
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
        className="w-full max-w-sm rounded-[26px] overflow-hidden relative"
        style={{ background: "#FFFFFF", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
      >
        {/* 헤더 그라데이션 */}
        <div className="relative px-6 pt-7 pb-6" style={{ background: "linear-gradient(135deg, #FFF1D9 0%, #FFE0C0 100%)" }}>
          <button
            type="button"
            onClick={close}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-white/55 active:scale-90"
            aria-label="닫기"
          >
            <X size={15} style={{ color: "#7A4F30" }} />
          </button>
          <p className="text-[10px] font-extrabold tracking-[0.2em] mb-2" style={{ color: "#3E6FA8" }}>오늘 이거 해보세요</p>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-3xl" style={{ background: "#FFFFFF", boxShadow: "0 4px 14px rgba(76,130,188,0.25)" }}>
              {spot.emoji}
            </div>
            <div className="min-w-0">
              <p className="text-[17px] font-extrabold text-text-main leading-tight tracking-tight">{spot.title}</p>
              <p className="text-[12px] text-text-sub mt-1 leading-snug">{spot.desc}</p>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-6 pt-5 pb-6">
          <Link
            href={spot.href}
            onClick={close}
            className="flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-white text-[14px] font-extrabold active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #4C82BC 0%, #3E6FA8 100%)", boxShadow: "0 4px 14px rgba(76,130,188,0.4)" }}
          >
            {spot.cta} <ChevronRight size={15} />
          </Link>

          <p className="text-[10.5px] font-extrabold tracking-[0.12em] mt-5 mb-2.5" style={{ color: "#3E6FA8" }}>이런 기능도 있어요</p>
          <div className="grid grid-cols-3 gap-2">
            {CHIPS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                onClick={close}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl active:scale-[0.97] transition-transform"
                style={{ background: "#FAF5EE", border: "1px solid rgba(76,130,188,0.12)" }}
              >
                <span className="text-xl">{c.emoji}</span>
                <span className="text-[11px] font-bold" style={{ color: "#5C4A3E" }}>{c.label}</span>
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={close}
            className="w-full mt-4 text-[12px] font-bold text-text-sub py-1.5"
          >
            오늘은 그냥 둘러볼게요
          </button>
        </div>
      </div>
    </div>
  );
}
