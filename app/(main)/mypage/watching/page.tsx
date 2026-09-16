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
import { catArtWalkSvg } from "@/lib/cat-art";

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
    <div className="min-h-dvh pb-6" style={{ background: "var(--color-surface)" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-2 sticky top-0 z-10" style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
        <Link
          href="/mypage"
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong -ml-2"
          aria-label="마이페이지로"
        >
          <ArrowLeft size={22} className="text-text-main" />
        </Link>
        <h1 className="text-[17px] font-bold text-text-main">내가 지켜보는 아이</h1>
      </div>

      <section className="px-5 mt-2">
        {loading || authLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />
          </div>
        ) : !user ? (
          <div className="card p-6 text-center">
            <p className="text-[15px] font-semibold text-text-main mb-2">로그인이 필요해요</p>
            <p className="text-[13px] text-text-sub mb-4">하트 누른 아이들을 모아보려면 로그인해주세요.</p>
            <Link
              href="/login?next=/mypage/watching"
              className="inline-flex items-center px-6 h-10 rounded-lg text-[13px] font-semibold press"
              style={{ background: "var(--color-primary)", color: "var(--color-surface)" }}
            >
              로그인하기
            </Link>
          </div>
        ) : cats.length === 0 ? (
          <div className="card p-6 text-center">
            <Heart size={28} className="mx-auto mb-3 text-text-light" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-text-main mb-2">아직 지켜보는 아이가 없어요</p>
            <p className="text-[13px] text-text-sub leading-relaxed mb-4">
              고양이 카드에서 하트를 누르면 여기에 모여요.
            </p>
            <Link
              href="/map"
              className="inline-flex items-center gap-1.5 px-6 h-10 rounded-lg text-[13px] font-semibold press"
              style={{ background: "var(--color-primary)", color: "var(--color-surface)" }}
            >
              <PawPrint size={14} /> 우리 동네 고양이 보러 가기
            </Link>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-text-sub mb-2 px-1">
              {cats.length}마리를 지켜보고 있어요. 하트를 다시 누르면 목록에서 빠져요.
            </p>
            <div className="card px-4">
              {cats.map((c) => {
                const h = HEALTH_MAP[c.health_status as CatHealthStatus] ?? HEALTH_MAP.good;
                const safe = sanitizeImageUrl(c.photo_url ?? null, "");
                const photo = thumbnailUrl(safe, 96) ?? safe;
                return (
                  <Link
                    key={c.id}
                    href={`/cats/${c.id}`}
                    className="flex items-center gap-3 py-3 press transition-transform border-b border-divider last:border-b-0"
                    style={{ minHeight: 64 }}
                  >
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ background: "var(--color-gray-100)" }}
                    >
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo}
                          alt={c.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 flex items-center justify-center"
                          aria-hidden
                          dangerouslySetInnerHTML={{ __html: catArtWalkSvg(c.id, 36) }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-text-main truncate">{c.name}</p>
                      <p className="text-[13px] text-text-sub mt-0.5">{h.label}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleUnheart(e, c.id)}
                      disabled={busyId === c.id}
                      aria-label={`${c.name} 지켜보기 해제`}
                      className="w-9 h-9 rounded-full flex items-center justify-center press-strong disabled:opacity-60 shrink-0"
                    >
                      <Heart size={18} style={{ color: "var(--color-like)", fill: "var(--color-like)" }} strokeWidth={2} />
                    </button>
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
