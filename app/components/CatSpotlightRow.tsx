"use client";

// 고양이 스포트라이트 가로 줄 + 지켜보기(하트) 토글 (STEP2, 2026-09-02)
// - cats prop이 있으면 그대로 렌더(랜딩: 서버 프리페치), 없으면 cats_public_map에서 자체 조회(로그인 홈).
// - 하트는 기존 cat_likes를 재사용(toggleCatLike) — 별도 테이블 신설 없음.
//   비로그인이 누르면 해당 고양이로 돌아오는 가입 동선으로 보낸다.
// 2026-09-16 「익숙한 동네앱」 리디자인: 사진은 원형·크게(84px), 상태 배지는 이름 아래 글자로
// (위험=error·주의=warning), 사진 없으면 마커 아트 SVG.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  HEALTH_MAP,
  thumbnailUrl,
  toggleCatLike,
  listMyLikedCatIds,
  type CatHealthStatus,
} from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { catArtWalkSvg } from "@/lib/cat-art";

export type SpotlightCat = {
  id: string;
  name: string;
  photo_url: string | null;
  health_status: string;
};

// 상태별 글자색 — 의미색 토큰만 (양호는 강조 없음)
const HEALTH_TEXT: Record<CatHealthStatus, string> = {
  good: "var(--color-text-light)",
  caution: "var(--color-warning)",
  danger: "var(--color-error)",
};

export default function CatSpotlightRow({
  cats,
  title = "우리가 함께 지켜보는 아이들",
  className = "",
}: {
  cats?: SpotlightCat[];
  title?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<SpotlightCat[]>(cats ?? []);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  // cats prop 없이 쓰이면(로그인 홈) 클라이언트에서 동일 로직으로 조회
  useEffect(() => {
    if (cats) return;
    const sb = createClient();
    Promise.all([
      sb
        .from("cats_public_map")
        .select("id, name, photo_url, health_status")
        .in("health_status", ["danger", "caution"])
        .not("photo_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(12),
      sb
        .from("cats_public_map")
        .select("id, name, photo_url, health_status")
        .eq("health_status", "good")
        .not("photo_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(12),
    ])
      .then(([alertRes, fillRes]) => {
        const alerts = ((alertRes.data ?? []) as SpotlightCat[]).sort(
          (a, b) => (a.health_status === "danger" ? 0 : 1) - (b.health_status === "danger" ? 0 : 1),
        );
        setItems([...alerts, ...((fillRes.data ?? []) as SpotlightCat[])].slice(0, 12));
      })
      .catch(() => {});
  }, [cats]);

  // 내가 하트 누른 아이들 (로그인 시에만)
  useEffect(() => {
    if (!user) return;
    listMyLikedCatIds().then(setLiked).catch(() => {});
  }, [user]);

  const handleHeart = async (e: React.MouseEvent, catId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      // 비로그인 → 가입 후 이 아이에게 돌아오는 동선
      router.push(`/signup?next=${encodeURIComponent(`/cats/${catId}`)}`);
      return;
    }
    if (busyId) return;
    setBusyId(catId);
    // 낙관적 토글 → 실패 시 되돌림
    const turningOn = !liked.has(catId);
    setLiked((prev) => {
      const next = new Set(prev);
      if (turningOn) next.add(catId);
      else next.delete(catId);
      return next;
    });
    try {
      await toggleCatLike(catId);
    } catch {
      setLiked((prev) => {
        const next = new Set(prev);
        if (turningOn) next.delete(catId);
        else next.add(catId);
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <section className={className}>
      <div className="px-5 mb-3">
        <h2 className="text-[17px] font-bold text-text-main">{title}</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto no-scrollbar px-5 pb-1">
        {items.map((c) => {
          const status: CatHealthStatus = c.health_status in HEALTH_MAP ? (c.health_status as CatHealthStatus) : "good";
          const h = HEALTH_MAP[status];
          const safe = sanitizeImageUrl(c.photo_url, "");
          const photo = safe ? thumbnailUrl(safe, 240) ?? safe : "";
          const isLiked = liked.has(c.id);
          return (
            <Link key={c.id} href={`/cats/${c.id}`} className="shrink-0 w-[84px] press transition-transform">
              <div className="relative w-[84px] h-[84px]">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={c.name}
                    loading="lazy"
                    decoding="async"
                    className="w-[84px] h-[84px] rounded-full object-cover"
                    style={{ border: "1px solid var(--color-border)" }}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="w-[84px] h-[84px] rounded-full flex items-center justify-center overflow-hidden"
                    style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
                    dangerouslySetInnerHTML={{ __html: catArtWalkSvg(c.id, 60, { walking: false }) }}
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => handleHeart(e, c.id)}
                  disabled={busyId === c.id}
                  aria-label={isLiked ? `${c.name} 지켜보기 해제` : `${c.name} 지켜보기`}
                  className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full flex items-center justify-center press-strong disabled:opacity-60"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <Heart
                    size={14}
                    color={isLiked ? "var(--color-like)" : "var(--color-text-sub)"}
                    fill={isLiked ? "var(--color-like)" : "none"}
                    strokeWidth={2}
                  />
                </button>
              </div>
              <p className="mt-2 text-[13px] font-semibold text-text-main text-center truncate">{c.name}</p>
              {status !== "good" && (
                <p className="text-[11px] font-medium text-center" style={{ color: HEALTH_TEXT[status] }}>
                  {h.label}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
