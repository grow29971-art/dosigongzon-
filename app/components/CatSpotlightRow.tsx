"use client";

// 고양이 스포트라이트 가로 카드 줄 + ❤️ 지켜보기 토글 (STEP2, 2026-09-02)
// - cats prop이 있으면 그대로 렌더(랜딩: 서버 프리페치), 없으면 cats_public_map에서 자체 조회(로그인 홈).
// - 하트는 기존 cat_likes를 재사용(toggleCatLike) — 별도 테이블 신설 없음.
//   비로그인이 누르면 해당 고양이로 돌아오는 가입 동선으로 보낸다.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, PawPrint } from "lucide-react";
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

export type SpotlightCat = {
  id: string;
  name: string;
  photo_url: string | null;
  health_status: string;
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
      <div className="px-5 flex items-center gap-1.5 mb-2.5">
        <PawPrint size={14} style={{ color: "var(--color-primary)" }} />
        <h2 className="text-[15px] font-bold text-text-main tracking-tight">{title}</h2>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-5 pb-1">
        {items.map((c) => {
          const h = HEALTH_MAP[c.health_status as CatHealthStatus] ?? HEALTH_MAP.good;
          const safe = sanitizeImageUrl(c.photo_url, "https://placehold.co/240x240/EEEAE2/2A2A28?text=%3F");
          const photo = thumbnailUrl(safe, 240) ?? safe;
          const isLiked = liked.has(c.id);
          return (
            <Link key={c.id} href={`/cats/${c.id}`} className="shrink-0 w-[104px] press transition-transform">
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{ boxShadow: "var(--shadow-card-sm)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt={c.name}
                  loading="lazy"
                  decoding="async"
                  className="w-[104px] h-[104px] object-cover"
                />
                <span
                  className="absolute top-1.5 left-1.5 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: h.color }}
                >
                  {h.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleHeart(e, c.id)}
                  disabled={busyId === c.id}
                  aria-label={isLiked ? `${c.name} 지켜보기 해제` : `${c.name} 지켜보기`}
                  className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center press-strong disabled:opacity-60"
                  style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
                >
                  <Heart
                    size={14}
                    color={isLiked ? "#E0533D" : "var(--color-text-sub)"}
                    fill={isLiked ? "#E0533D" : "none"}
                    strokeWidth={2.2}
                  />
                </button>
              </div>
              <p className="mt-1.5 text-[12px] font-bold text-text-main text-center truncate">{c.name}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
