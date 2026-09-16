"use client";

// 우리 동네 고양이 도감 — 수집 메커니즘. cats+care_logs+cat_comments에서 파생(DB 없음).
// 만난 고양이 = 컬러 카드, 미수집 = 실루엣 → "만나러 가기"로 돌봄 유도.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, PawPrint, MapPin, Map } from "lucide-react";
import { getNeighborhoodCollection, type NeighborhoodCollection } from "@/lib/collection-repo";
import { thumbnailUrl } from "@/lib/cats-repo";
import { catArtWalkSvg } from "@/lib/cat-art";

export default function CollectionPage() {
  const [data, setData] = useState<NeighborhoodCollection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNeighborhoodCollection()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const pct = data && data.total > 0 ? Math.round((data.collectedCount / data.total) * 100) : 0;

  return (
    <div className="min-h-dvh bg-surface pb-28">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3" style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
        <Link href="/" className="w-9 h-9 rounded-full flex items-center justify-center press-strong transition-transform -ml-2" aria-label="홈으로">
          <ChevronLeft size={22} className="text-text-main" />
        </Link>
        <h1 className="text-[17px] font-bold text-text-main">우리 동네 고양이 도감</h1>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto w-full">
        {loading && (
          <p className="text-center text-[13px] text-text-sub py-16">도감을 불러오는 중…</p>
        )}

        {!loading && data && !data.hasRegion && (
          <EmptyPrompt
            icon={<Map size={32} strokeWidth={1.5} />}
            title="활동 지역을 먼저 설정해주세요"
            desc="우리 동네를 정하면 그 동네 고양이로 도감을 채워요."
            ctaLabel="활동 지역 설정"
            href="/mypage/activity-regions"
          />
        )}

        {!loading && data && data.hasRegion && data.total === 0 && (
          <EmptyPrompt
            icon={<PawPrint size={32} strokeWidth={1.5} />}
            title={`${data.regionName}에 아직 등록된 고양이가 없어요`}
            desc="첫 고양이를 등록하면 도감이 시작돼요."
            ctaLabel="지도에서 등록하기"
            href="/map"
          />
        )}

        {!loading && data && data.total > 0 && (
          <>
            {/* 진행률 */}
            <div className="mb-5 card p-4">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[15px] font-semibold text-text-main">
                  {data.regionName} 도감
                </p>
                <p className="text-[13px] font-semibold text-text-sub">
                  <span className="text-text-main">{data.collectedCount}</span> / {data.total}마리 ({pct}%)
                </p>
              </div>
              <div className="progress-bar">
                <div style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
              </div>
              <p className="text-[13px] text-text-sub mt-2 leading-snug">
                돌봄·댓글을 남기면 도감이 채워져요.
              </p>
            </div>

            {/* 그리드 */}
            <div className="grid grid-cols-3 gap-2.5">
              {data.cats.map((c) => {
                const thumb = c.collected ? thumbnailUrl(c.photoUrl, 160) : null;
                return (
                  <Link
                    key={c.id}
                    href={`/cats/${c.id}`}
                    className="block press-strong transition-transform"
                  >
                    <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                      <div
                        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                        style={{
                          background: "var(--color-gray-100)",
                          border: c.collected ? "1px solid var(--color-border)" : "1px dashed var(--color-gray-300)",
                        }}
                      >
                        {c.collected ? (
                          thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <div
                              className="w-[70%] h-[70%] flex items-center justify-center"
                              aria-hidden
                              dangerouslySetInnerHTML={{ __html: catArtWalkSvg(c.id, 64) }}
                            />
                          )
                        ) : (
                          <PawPrint size={26} style={{ color: "var(--color-text-muted)" }} />
                        )}
                      </div>
                      {c.mine && (
                        <span className="absolute top-0 left-0 text-[11px] font-semibold px-1.5 py-0.5 chip-square" style={{ background: "var(--color-primary)", color: "var(--color-surface)" }}>내 아이</span>
                      )}
                    </div>
                    <p className={`text-[13px] font-medium text-center mt-1 truncate ${c.collected ? "text-text-main" : "text-text-light"}`}>
                      {c.collected ? c.name : "???"}
                    </p>
                  </Link>
                );
              })}
            </div>

            {data.collectedCount < data.total && (
              <Link
                href="/map"
                className="mt-5 flex items-center justify-center gap-2 h-12 text-[15px] font-semibold press transition-transform"
                style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
              >
                <MapPin size={16} /> 지도에서 못 만난 고양이 만나러 가기
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyPrompt({ icon, title, desc, ctaLabel, href }: { icon: React.ReactNode; title: string; desc: string; ctaLabel: string; href: string }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="flex justify-center mb-3 text-text-light">{icon}</div>
      <p className="text-[15px] font-semibold text-text-main mb-1.5">{title}</p>
      <p className="text-[13px] text-text-sub leading-relaxed mb-5">{desc}</p>
      <Link
        href={href}
        className="inline-flex items-center justify-center gap-2 px-6 h-12 text-[15px] font-semibold press transition-transform"
        style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
