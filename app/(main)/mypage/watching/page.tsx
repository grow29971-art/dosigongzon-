"use client";

// 내가 지켜보는 아이 — 하트(cat_likes) 누른 고양이 모아보기 (STEP2, 2026-09-02)

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, Loader2, PawPrint } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listMyLikedCats,
  toggleCatLike,
  thumbnailUrl,
  HEALTH_MAP,
  type Cat,
  type CatHealthStatus,
} from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

export default function WatchingPage() {
  const { user, loading: authLoading } = useAuth();
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    listMyLikedCats()
      .then(setCats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const handleUnheart = async (e: React.MouseEvent, catId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (busyId) return;
    setBusyId(catId);
    const prev = cats;
    setCats((cur) => cur.filter((c) => c.id !== catId));
    try {
      await toggleCatLike(catId);
    } catch {
      setCats(prev); // 실패 시 되돌림
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-dvh pb-6" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-2 sticky top-0 z-10" style={{ background: "#F7F4EE" }}>
        <Link
          href="/mypage"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center press-strong"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="마이페이지로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <h1 className="text-[17px] font-bold text-text-main">내가 지켜보는 아이</h1>
      </div>

      <section className="px-5 mt-2">
        {loading || authLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--color-primary)" }} />
          </div>
        ) : !user ? (
          <div className="rounded-2xl p-6 text-center bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-[15px] font-bold text-text-main mb-2">로그인이 필요해요</p>
            <p className="text-[13px] text-text-sub mb-4">하트 누른 아이들을 모아보려면 로그인해주세요.</p>
            <Link
              href="/login?next=/mypage/watching"
              className="inline-block px-6 py-2.5 rounded-2xl text-white text-[13px] font-bold press"
              style={{ background: "var(--color-primary)" }}
            >
              로그인하기
            </Link>
          </div>
        ) : cats.length === 0 ? (
          <div className="rounded-2xl p-6 text-center bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
            <Heart size={28} className="mx-auto mb-3" color="#E0533D" />
            <p className="text-[15px] font-bold text-text-main mb-2">아직 지켜보는 아이가 없어요</p>
            <p className="text-[13px] text-text-sub leading-relaxed mb-4">
              홈이나 고양이 카드에서 ❤️를 누르면
              <br />
              여기에 모여요.
            </p>
            <Link
              href="/map"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-2xl text-white text-[13px] font-bold press"
              style={{ background: "var(--color-primary)" }}
            >
              <PawPrint size={14} /> 우리 동네 고양이 보러 가기
            </Link>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-text-sub mb-3 px-1">
              {cats.length}마리를 지켜보고 있어요. 하트를 다시 누르면 목록에서 빠져요.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {cats.map((c) => {
                const h = HEALTH_MAP[c.health_status as CatHealthStatus] ?? HEALTH_MAP.good;
                const safe = sanitizeImageUrl(c.photo_url ?? null, "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F");
                const photo = thumbnailUrl(safe, 400) ?? safe;
                return (
                  <Link
                    key={c.id}
                    href={`/cats/${c.id}`}
                    className="block rounded-2xl overflow-hidden bg-white press transition-transform"
                    style={{ boxShadow: "var(--shadow-card-sm)" }}
                  >
                    <div className="relative" style={{ aspectRatio: "1/1" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo}
                        alt={c.name}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <span
                        className="absolute top-2 left-2 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: h.color }}
                      >
                        {h.label}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleUnheart(e, c.id)}
                        disabled={busyId === c.id}
                        aria-label={`${c.name} 지켜보기 해제`}
                        className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center press-strong disabled:opacity-60"
                        style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
                      >
                        <Heart size={15} color="#E0533D" fill="#E0533D" strokeWidth={2.2} />
                      </button>
                    </div>
                    <p className="px-2.5 py-2 text-[13px] font-bold text-text-main truncate">{c.name}</p>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
