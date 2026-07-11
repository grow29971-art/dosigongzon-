"use client";

// 첫 응원 카드 — 활성화 사다리의 1단. (HomeAuthed, catCount===0 신규에게만)
// 가장 낮은 마찰의 첫 기여 = 우리 동네 실제 고양이에게 1탭 '응원(좋아요)'.
// 거울효과(다른 아이를 먼저 봄) + 심리적 투자 → 응원하면 '고양이 등록'으로 escalation.
// 고양이를 1마리라도 등록하면 catCount>0이 되어 이 카드는 자연히 사라짐(부모 게이트).

import { useState } from "react";
import Link from "next/link";
import { Heart, PawPrint, ChevronRight } from "lucide-react";
import { toggleCatLike, thumbnailUrl, type Cat } from "@/lib/cats-repo";

export default function FirstCheerCard({ cats, regionName }: { cats: Cat[]; regionName: string | null }) {
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [cheered, setCheered] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (cats.length === 0) return null;

  const cheer = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      const { liked: nowLiked } = await toggleCatLike(id);
      setLiked((prev) => {
        const next = new Set(prev);
        if (nowLiked) next.add(id);
        else next.delete(id);
        return next;
      });
      if (nowLiked) {
        setCheered(true);
        try { navigator.vibrate?.(12); } catch { /* 햅틱 미지원 */ }
      }
    } catch {
      /* 로그인 필요 등 — 무시 */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="mb-3 p-4"
      style={{
        background: "linear-gradient(135deg, #FFF3F6 0%, #FFE7EC 100%)",
        borderRadius: "var(--radius-card)",
        border: "1px solid rgba(232,107,140,0.22)",
        boxShadow: "0 6px 20px rgba(232,107,140,0.12)",
      }}
    >
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg" style={{ background: "linear-gradient(135deg, #E86B8C 0%, #D85577 100%)" }}>
          🐾
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.12em]" style={{ color: "#D85577" }}>첫 발걸음</p>
          <p className="text-[14px] font-extrabold text-text-main leading-tight mt-0.5">
            {cheered
              ? "응원 고마워요! 🎉"
              : `${regionName ? regionName + " " : "우리 동네 "}고양이에게 응원을 보내보세요`}
          </p>
          <p className="text-[11.5px] text-text-sub mt-0.5 leading-snug">
            {cheered ? "이제 직접 돌보는 아이도 등록해볼까요?" : "하트 한 번이면 돼요 — 가장 쉬운 첫 참여 🩷"}
          </p>
        </div>
      </div>

      {/* 동네 고양이 카드 (최대 3) */}
      <div className="flex gap-2.5">
        {cats.map((c) => {
          const isLiked = liked.has(c.id);
          const thumb = thumbnailUrl(c.photo_url, 160);
          return (
            <div key={c.id} className="flex-1 min-w-0 rounded-2xl overflow-hidden bg-white" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
              <Link href={`/cats/${c.id}`} className="block relative" style={{ aspectRatio: "1 / 1" }}>
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl" style={{ background: "#F4E6CE" }}>🐱</div>
                )}
              </Link>
              <div className="flex items-center justify-between px-2 py-1.5 gap-1">
                <span className="text-[11px] font-bold truncate" style={{ color: "#2A2A28" }}>{c.name}</span>
                <button
                  type="button"
                  onClick={() => cheer(c.id)}
                  disabled={busy === c.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                  style={{ background: isLiked ? "#E86B8C" : "rgba(232,107,140,0.12)" }}
                  aria-label={`${c.name} 응원하기`}
                >
                  <Heart size={14} fill={isLiked ? "#fff" : "none"} style={{ color: isLiked ? "#fff" : "#E86B8C" }} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {cheered && (
        <Link
          href="/map"
          className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-[13px] font-extrabold active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
        >
          <PawPrint size={14} /> 우리 동네 고양이 등록하기 <ChevronRight size={13} />
        </Link>
      )}
    </div>
  );
}
