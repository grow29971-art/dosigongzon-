import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, MapPin, Heart, MessageCircle } from "lucide-react";
import { getRescueCatsServer } from "@/lib/cats-server";
import { sanitizeImageUrl } from "@/lib/url-validate";

export const metadata: Metadata = {
  title: "긴급 구조 피드",
  description:
    "지금 도움이 필요한 길고양이들. 건강 상태가 '위험'으로 기록된 아이들의 최신 소식.",
  alternates: { canonical: "/rescue" },
  robots: { index: false, follow: false }, // 긴급 정보는 SEO 노출 민감
};

function timeSince(iso: string): string {
  const diffH = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (diffH < 1) return "방금";
  if (diffH < 24) return `${diffH}시간 전`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default async function RescuePage() {
  const cats = await getRescueCatsServer(50);

  return (
    <div className="pb-24 min-h-screen" style={{ background: "var(--color-surface)" }}>
      {/* 헤더 — 긴급성 톤 */}
      <div className="px-5 pt-12 pb-4">
        <Link
          href="/"
          className="flex items-center gap-1 text-[13px] font-semibold mb-3 text-text-sub press-strong"
        >
          <ArrowLeft size={14} />
          홈으로
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={20} style={{ color: "var(--color-error)" }} />
          <h1 className="text-[24px] font-bold tracking-tight text-text-main">
            긴급 구조 피드
          </h1>
        </div>
        <p className="text-[13px] text-text-sub">
          지금 도움이 필요한 아이들 · 가장 가까운 이웃의 손길이 절실해요
        </p>
      </div>

      {/* 카운트 바 */}
      <div className="px-4 mb-4">
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="w-9 h-9 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} style={{ color: "var(--color-error)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-text-sub">
              위험 상태로 기록된 아이
            </p>
            <p className="text-[24px] font-bold tracking-tight" style={{ color: "var(--color-error)" }}>
              {cats.length}마리
            </p>
          </div>
          <div
            className="px-2.5 py-1 chip-square text-[11px] font-semibold flex items-center gap-1"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-error)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-error)" }} />
            LIVE
          </div>
        </div>
      </div>

      {/* 리스트 */}
      <div className="px-4">
        {cats.length === 0 ? (
          <div
            className="bg-white rounded-xl p-8 text-center"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <Heart size={28} strokeWidth={1.4} className="mx-auto mb-2 text-text-light" />
            <p className="text-[15px] font-bold text-text-main mb-1">
              지금 긴급 상태인 아이가 없어요
            </p>
            <p className="text-[13px] text-text-sub">
              모두 안전한 순간이에요. 평소처럼 돌봄 기록을 이어가 주세요.
            </p>
          </div>
        ) : (
          <div>
            {cats.map((cat) => {
              const photo = sanitizeImageUrl(cat.photo_url, "");
              return (
                <Link
                  key={cat.id}
                  href={`/cats/${cat.id}`}
                  className="block press transition-transform"
                >
                  <div className="flex gap-3 py-3 border-b border-divider last:border-b-0">
                    {/* 사진 */}
                    <div
                      className="w-20 h-20 shrink-0 rounded-lg"
                      style={{
                        background: photo
                          ? `url('${photo}') center/cover`
                          : "var(--color-gray-100)",
                      }}
                    />
                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="px-1.5 py-0.5 chip-square text-[11px] font-semibold flex items-center gap-1"
                          style={{ border: "1px solid var(--color-border)", color: "var(--color-error)" }}
                        >
                          위험
                        </span>
                        <span className="text-[11px] text-text-light">
                          {timeSince(cat.created_at)}
                        </span>
                      </div>
                      <h2 className="text-[15px] font-semibold text-text-main tracking-tight leading-tight truncate">
                        {cat.name}
                      </h2>
                      {cat.region && (
                        <p className="flex items-center gap-1 text-[11px] text-text-sub mt-0.5">
                          <MapPin size={10} />
                          {cat.region}
                        </p>
                      )}
                      {cat.description && (
                        <p className="text-[13px] text-text-sub mt-1 line-clamp-2 leading-snug">
                          {cat.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-text-light">
                        <span className="flex items-center gap-0.5">
                          <Heart size={10} />
                          {cat.like_count ?? 0}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle size={10} />
                          댓글
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* 하단 안내 */}
        <div
          className="mt-5 rounded-xl p-4 text-[13px] leading-snug"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="font-bold text-text-main mb-1">도움을 주고 싶다면</p>
          <ol className="space-y-1 text-text-sub pl-4 list-decimal">
            <li>가장 가까운 아이부터 직접 방문해 상태 확인</li>
            <li>
              <Link href="/protection/emergency-guide" className="font-bold text-primary">
                응급 대처 가이드
              </Link>
              를 보며 단계별 대응
            </li>
            <li>필요 시 구조 지원 병원 연락 (지도 → 구조동물 도움 병원)</li>
            <li>돌봄다이어리로 현재 상태 공유 — 다른 이웃도 이어서 챙길 수 있어요</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
