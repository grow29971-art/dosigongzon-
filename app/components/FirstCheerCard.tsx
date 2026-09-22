"use client";

// 첫 응원 카드 — 활성화 사다리의 1단. (HomeAuthed, catCount===0 신규에게만)
// 가장 낮은 마찰의 첫 기여 = 우리 동네 실제 고양이에게 1탭 '응원(좋아요)'.
// 거울효과(다른 아이를 먼저 봄) + 심리적 투자 → 응원하면 '고양이 등록'으로 escalation.
// 고양이를 1마리라도 등록하면 catCount>0이 되어 이 카드는 자연히 사라짐(부모 게이트).
// 2026-09-16 「익숙한 동네앱」 리디자인: 분홍 틴트·글로우 → 흰 면 + 헤어라인, 원형 썸네일, 하트만 like 의미색.

import { useState } from "react";
import Link from "next/link";
import { Heart, ChevronRight } from "lucide-react";
import { toggleCatLike, thumbnailUrl, type Cat } from "@/lib/cats-repo";
import { catArtWalkSvg } from "@/lib/cat-art";

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
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="mb-3">
        <p className="text-[11px] font-medium text-text-light">첫 발걸음</p>
        <p className="text-[15px] font-semibold text-text-main leading-snug mt-0.5">
          {cheered
            ? "응원 고마워요"
            : `${regionName ? regionName + " " : "우리 동네 "}고양이에게 응원을 보내보세요`}
        </p>
        <p className="text-[13px] text-text-sub mt-0.5 leading-snug">
          {cheered ? "이제 직접 돌보는 아이도 등록해볼까요?" : "하트 한 번이면 돼요 — 가장 쉬운 첫 참여"}
        </p>
      </div>

      {/* 동네 고양이 (최대 3) — 원형 썸네일 + 이름 + 하트 */}
      <div className="flex gap-3">
        {cats.map((c) => {
          const isLiked = liked.has(c.id);
          const thumb = thumbnailUrl(c.photo_url, 160);
          return (
            <div key={c.id} className="flex-1 min-w-0 flex flex-col items-center">
              <Link
                href={`/cats/${c.id}`}
                className="block w-16 h-16 rounded-full overflow-hidden"
                style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: catArtWalkSvg(c.id, 44, { walking: false }) }}
                  />
                )}
              </Link>
              <span className="text-[13px] font-medium text-text-main truncate w-full text-center mt-1.5">{c.name}</span>
              <button
                type="button"
                onClick={() => cheer(c.id)}
                disabled={busy === c.id}
                className="mt-1 h-8 px-3 flex items-center justify-center gap-1 press-strong transition-transform"
                style={{
                  borderRadius: "var(--radius-input)",
                  background: isLiked ? "var(--color-like-soft)" : "var(--color-surface)",
                  border: `1px solid ${isLiked ? "transparent" : "var(--color-border)"}`,
                  color: isLiked ? "var(--color-like)" : "var(--color-text-sub)",
                }}
                aria-label={`${c.name} 응원하기`}
              >
                <Heart size={14} fill={isLiked ? "var(--color-like)" : "none"} strokeWidth={2} />
                <span className="text-[13px] font-medium">응원</span>
              </button>
            </div>
          );
        })}
      </div>

      {cheered && (
        <Link
          href="/map"
          className="mt-3 h-10 flex items-center justify-center gap-1 text-[15px] font-semibold press transition-transform"
          style={{ borderRadius: "var(--radius-input)", background: "var(--color-primary)", color: "var(--color-surface)" }}
        >
          우리 동네 고양이 등록하기 <ChevronRight size={15} />
        </Link>
      )}
    </div>
  );
}
