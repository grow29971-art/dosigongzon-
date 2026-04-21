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
    <div className="pb-24 min-h-screen" style={{ background: "#FFF4F4" }}>
      {/* 헤더 — 긴급성 톤 */}
      <div
        className="px-5 pt-12 pb-5"
        style={{
          background: "linear-gradient(135deg, #D85555 0%, #B84545 100%)",
          color: "#fff",
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-1 text-[12px] font-semibold mb-3 opacity-85 active:scale-95"
        >
          <ArrowLeft size={14} />
          홈으로
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={20} />
          <h1 className="text-[22px] font-extrabold tracking-tight">
            긴급 구조 피드
          </h1>
        </div>
        <p className="text-[12px] opacity-85">
          지금 도움이 필요한 아이들 · 가장 가까운 이웃의 손길이 절실해요
        </p>
      </div>

      {/* 카운트 바 */}
      <div
        className="px-4 -mt-3 mb-4 relative"
        style={{ zIndex: 1 }}
      >
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{
            background: "#FFFFFF",
            boxShadow: "0 4px 14px rgba(216,85,85,0.12)",
            border: "1px solid rgba(216,85,85,0.18)",
          }}
        >
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #E88D5A 0%, #D85555 100%)",
            }}
          >
            <span className="text-[16px]">🚨</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-text-sub">
              위험 상태로 기록된 아이
            </p>
            <p className="text-[22px] font-extrabold tracking-tight" style={{ color: "#D85555" }}>
              {cats.length}마리
            </p>
          </div>
          <div
            className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold flex items-center gap-1"
            style={{ background: "#FDECEC", color: "#B84545" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#D85555" }} />
            LIVE
          </div>
        </div>
      </div>

      {/* 리스트 */}
      <div className="px-4">
        {cats.length === 0 ? (
          <div
            className="bg-white rounded-2xl p-8 text-center"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[30px] mb-2">💚</p>
            <p className="text-[14px] font-extrabold text-text-main mb-1">
              지금 긴급 상태인 아이가 없어요
            </p>
            <p className="text-[12px] text-text-sub">
              모두 안전한 순간이에요. 평소처럼 돌봄 기록을 이어가 주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cats.map((cat) => {
              const photo = sanitizeImageUrl(cat.photo_url, "");
              return (
                <Link
                  key={cat.id}
                  href={`/cats/${cat.id}`}
                  className="block active:scale-[0.99] transition-transform"
                >
                  <div
                    className="rounded-2xl overflow-hidden flex gap-3"
                    style={{
                      background: "#FFFFFF",
                      boxShadow: "0 4px 14px rgba(216,85,85,0.08)",
                      border: "1.5px solid #D8555525",
                    }}
                  >
                    {/* 사진 */}
                    <div
                      className="w-24 h-24 shrink-0"
                      style={{
                        background: photo
                          ? `url('${photo}') center/cover`
                          : "#EEE8E0",
                      }}
                    />
                    {/* 내용 */}
                    <div className="flex-1 min-w-0 py-2.5 pr-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="px-2 py-0.5 rounded-lg text-[9.5px] font-extrabold flex items-center gap-1"
                          style={{ background: "#D85555", color: "#fff" }}
                        >
                          🚨 위험
                        </span>
                        <span className="text-[10.5px] text-text-light">
                          {timeSince(cat.created_at)}
                        </span>
                      </div>
                      <h2 className="text-[15px] font-extrabold text-text-main tracking-tight leading-tight truncate">
                        {cat.name}
                      </h2>
                      {cat.region && (
                        <p className="flex items-center gap-1 text-[11px] text-text-sub mt-0.5">
                          <MapPin size={10} />
                          {cat.region}
                        </p>
                      )}
                      {cat.description && (
                        <p className="text-[11.5px] text-text-sub mt-1 line-clamp-2 leading-snug">
                          {cat.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[10.5px] text-text-light">
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
          className="mt-5 rounded-2xl p-4 text-[11.5px] leading-snug"
          style={{ background: "#FFF9F0", border: "1px solid rgba(232,141,90,0.25)" }}
        >
          <p className="font-extrabold text-text-main mb-1">💡 도움을 주고 싶다면</p>
          <ol className="space-y-1 text-text-sub pl-4 list-decimal">
            <li>가장 가까운 아이부터 직접 방문해 상태 확인</li>
            <li>
              <Link href="/protection/emergency-guide" className="font-bold text-primary">
                응급 대처 가이드
              </Link>
              를 보며 단계별 대응
            </li>
            <li>필요 시 구조 지원 병원 연락 (지도 → 구조동물 도움 병원)</li>
            <li>돌봄 일지로 현재 상태 공유 — 다른 이웃도 이어서 챙길 수 있어요</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
