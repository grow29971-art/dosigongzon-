"use client";

// 우리 동네 고양이 도감 — 수집 메커니즘. cats+care_logs+cat_comments에서 파생(DB 없음).
// 만난 고양이 = 컬러 카드, 미수집 = 실루엣 → "만나러 가기"로 돌봄 유도.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, PawPrint, MapPin } from "lucide-react";
import { getNeighborhoodCollection, type NeighborhoodCollection } from "@/lib/collection-repo";
import { thumbnailUrl } from "@/lib/cats-repo";

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
    <div className="min-h-dvh bg-warm-white pb-28">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3" style={{ background: "rgba(255,253,248,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(92,141,238,0.12)" }}>
        <Link href="/" className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: "rgba(92,141,238,0.1)" }} aria-label="홈으로">
          <ChevronLeft size={18} style={{ color: "#8B6FE0" }} />
        </Link>
        <h1 className="text-[16px] font-extrabold text-text-main tracking-tight">우리 동네 고양이 도감</h1>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto w-full">
        {loading && (
          <p className="text-center text-[13px] text-text-sub py-16">도감을 불러오는 중…</p>
        )}

        {!loading && data && !data.hasRegion && (
          <EmptyPrompt
            emoji="🗺️"
            title="활동 지역을 먼저 설정해주세요"
            desc="우리 동네를 정하면 그 동네 고양이들로 도감을 채울 수 있어요."
            ctaLabel="활동 지역 설정"
            href="/mypage/activity-regions"
          />
        )}

        {!loading && data && data.hasRegion && data.total === 0 && (
          <EmptyPrompt
            emoji="🐾"
            title={`${data.regionName}에 아직 등록된 고양이가 없어요`}
            desc="우리 동네 첫 고양이를 등록하면 도감이 시작돼요."
            ctaLabel="지도에서 등록하기"
            href="/map"
          />
        )}

        {!loading && data && data.total > 0 && (
          <>
            {/* 진행률 */}
            <div className="mb-5 p-4 rounded-2xl" style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #FCF6EC 100%)", border: "1px solid rgba(92,141,238,0.18)", boxShadow: "0 4px 14px rgba(92,141,238,0.08)" }}>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[12px] font-extrabold" style={{ color: "#8B6FE0" }}>
                  {data.regionName} 도감
                </p>
                <p className="text-[13px] font-extrabold text-text-main">
                  <span style={{ color: "#5C8DEE" }}>{data.collectedCount}</span> / {data.total} 마리 ({pct}%)
                </p>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(92,141,238,0.15)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #5C8DEE 0%, #E88D5A 100%)" }} />
              </div>
              <p className="text-[11px] text-text-sub mt-2 leading-snug">
                만난 고양이는 컬러로, 아직 못 만난 아이는 실루엣으로 보여요. 돌봄·댓글을 남기면 도감이 채워져요 🐾
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
                    className="block active:scale-[0.97] transition-transform"
                  >
                    <div
                      className="relative w-full rounded-2xl overflow-hidden flex items-center justify-center"
                      style={{
                        aspectRatio: "1 / 1",
                        background: c.collected ? "#F4E6CE" : "rgba(120,110,100,0.08)",
                        border: c.collected ? "1.5px solid rgba(92,141,238,0.3)" : "1.5px dashed rgba(120,110,100,0.2)",
                      }}
                    >
                      {c.collected ? (
                        thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl">🐱</span>
                        )
                      ) : (
                        <PawPrint size={26} style={{ color: "rgba(120,110,100,0.35)" }} />
                      )}
                      {c.mine && (
                        <span className="absolute top-1 left-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full text-white" style={{ background: "#5C8DEE" }}>내 아이</span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-center mt-1 truncate" style={{ color: c.collected ? "#2A2A28" : "rgba(120,110,100,0.6)" }}>
                      {c.collected ? c.name : "???"}
                    </p>
                  </Link>
                );
              })}
            </div>

            {data.collectedCount < data.total && (
              <Link
                href="/map"
                className="mt-5 flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-[13.5px] font-extrabold active:scale-[0.98] transition-transform"
                style={{ background: "linear-gradient(135deg, #5C8DEE 0%, #8B6FE0 100%)", boxShadow: "0 4px 14px rgba(92,141,238,0.35)" }}
              >
                <MapPin size={15} /> 지도에서 못 만난 고양이 만나러 가기
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyPrompt({ emoji, title, desc, ctaLabel, href }: { emoji: string; title: string; desc: string; ctaLabel: string; href: string }) {
  return (
    <div className="text-center py-12 px-4">
      <p className="text-4xl mb-3">{emoji}</p>
      <p className="text-[15px] font-extrabold text-text-main mb-1.5">{title}</p>
      <p className="text-[12.5px] text-text-sub leading-relaxed mb-5">{desc}</p>
      <Link
        href={href}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white text-[13.5px] font-extrabold active:scale-[0.98] transition-transform"
        style={{ background: "linear-gradient(135deg, #5C8DEE 0%, #8B6FE0 100%)", boxShadow: "0 4px 14px rgba(92,141,238,0.35)" }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
