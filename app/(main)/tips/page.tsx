// 꿀팁게시판 인덱스 — /tips
// 길고양이 돌봄·TNR·입양에 도움되는 정보글 큐레이션.
// 서버 컴포넌트, 10분 ISR.

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Sparkles, ChevronRight, Eye, Clock, ExternalLink, Pin, BookOpen, Siren, Baby, Stethoscope, Snowflake, Pill, Heart, Phone, Scale, AlertTriangle } from "lucide-react";
import { listPublishedTipsServer, type Tip } from "@/lib/tips-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { estimateReadingMinutes } from "@/lib/html-sanitize";
import TipsAdminFab from "./TipsAdminFab";
import TipsAIChatCard from "./TipsAIChatCard";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "꿀팁게시판 — 도시공존",
  description:
    "길고양이 돌봄·TNR·중성화·구조·입양에 도움되는 정보글 모음. 도시공존이 직접 큐레이션한 꿀팁을 한곳에서 확인하세요.",
  keywords: [
    "길고양이 꿀팁", "길고양이 돌봄법", "TNR 신청", "중성화", "임시보호",
    "고양이 구조", "겨울철 길고양이", "케어테이커 꿀팁", "도시공존 꿀팁게시판",
  ],
  alternates: { canonical: "/tips" },
  openGraph: {
    title: "꿀팁게시판 | 도시공존",
    description: "길고양이 돌봄에 도움되는 정보글 큐레이션.",
    url: "https://dosigongzon.com/tips",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "꿀팁게시판 | 도시공존",
    description: "길고양이 돌봄에 도움되는 정보글 큐레이션.",
  },
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
  } catch {
    return "";
  }
}

export default async function TipsIndexPage() {
  const items = await listPublishedTipsServer(50);

  // 태그 통계 (필터칩용)
  const tagCount = new Map<string, number>();
  for (const t of items) {
    for (const tag of t.tags) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
  }
  const popularTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  // ItemList JSON-LD
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "도시공존 꿀팁게시판",
    description:
      "길고양이 돌봄·TNR·중성화·구조·입양에 도움되는 정보글 모음.",
    itemListElement: items.slice(0, 20).map((tip, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `https://dosigongzon.com/tips/${tip.slug}`,
      name: tip.title,
    })),
  };

  return (
    <div className="pb-24" style={{ background: "#F7F4EE", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* 관리자 전용 작성 FAB (비관리자에겐 안 보임) */}
      <TipsAdminFab />

      {/* ── 헤더 ── */}
      <div className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main tracking-tight flex items-center gap-1.5">
            <BookOpen size={18} className="text-primary" />
            가이드
          </h1>
          <p className="text-[11px] text-text-sub">길고양이 돌봄 꿀팁 + 보호지침을 한곳에서</p>
        </div>
      </div>

      {/* ── 인기 태그 ── */}
      {popularTags.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
            {popularTags.map((tag) => (
              <Link
                key={tag}
                href={`/tips?tag=${encodeURIComponent(tag)}`}
                className="shrink-0 text-[11.5px] font-bold px-2.5 py-1 rounded-full bg-white text-text-sub border border-black/[0.04] active:scale-95 transition-transform"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── AI 집사 (꿀팁 페이지 상단 진입점) ── */}
      <div className="px-4 mb-4">
        <TipsAIChatCard />
      </div>

      {/* ── 🚨 보호지침 매뉴얼 (꿀팁과 통합) — 위급할 땐 여기 펼치기 ── */}
      <div className="px-4 mb-5">
        <div
          className="relative overflow-hidden p-4 pt-4"
          style={{
            background: "linear-gradient(135deg, #FFE6E0 0%, #FFCFB5 50%, #FFD9A8 100%)",
            borderRadius: 22,
            border: "1.5px solid rgba(216,85,85,0.25)",
            boxShadow: "0 8px 24px rgba(216,85,85,0.15), 0 2px 6px rgba(196,126,90,0.10)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -40,
              right: -30,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(216,85,85,0.18) 0%, rgba(216,85,85,0) 70%)",
            }}
          />

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={15} style={{ color: "#B83A2A" }} />
              <h2 className="text-[15px] font-extrabold tracking-tight" style={{ color: "#5C2A1E" }}>
                위급할 땐 여기로
              </h2>
            </div>
            <span
              className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md tracking-wider"
              style={{ background: "rgba(216,85,85,0.18)", color: "#A8392A" }}
            >
              구조 매뉴얼
            </span>
          </div>
          <p className="text-[11.5px] leading-snug mb-3" style={{ color: "rgba(92,42,30,0.80)" }}>
            응급·새끼 발견·TNR·법률까지 — 한 발 빠른 대처가 한 생명을 살려요
          </p>

          {/* 3×3 카테고리 grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { href: "/protection/emergency-guide", label: "응급처치", sub: "다쳤을 때", Icon: Siren, color: "#D85555" },
              { href: "/protection/kitten-guide", label: "새끼 발견", sub: "이런 땐 데려와요", Icon: Baby, color: "#E88D5A" },
              { href: "/protection/disease-guide", label: "질병 신호", sub: "증상 체크", Icon: Heart, color: "#E86B8C" },
              { href: "/protection/trapping-guide", label: "TNR·포획", sub: "안전한 절차", Icon: Stethoscope, color: "#8B65B8" },
              { href: "/protection/feeding-guide", label: "밥주기", sub: "올바른 방법", Icon: Sparkles, color: "#48A59E" },
              { href: "/protection/shelter-guide", label: "겨울 쉼터", sub: "지금 만들기", Icon: Snowflake, color: "#5A8AC4" },
              { href: "/protection/pharmacy-guide", label: "약품 안내", sub: "주변 약국", Icon: Pill, color: "#6B8E6F" },
              { href: "/protection/district-contacts", label: "지자체 연락", sub: "전국 240+ 곳", Icon: Phone, color: "#A8684A" },
              { href: "/protection/legal", label: "법률·신고", sub: "학대 대응", Icon: Scale, color: "#7A6B8E" },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="rounded-2xl px-2 py-2.5 flex flex-col items-center gap-1 active:scale-[0.96] transition-transform"
                style={{
                  background: "#FFFFFF",
                  boxShadow: "0 3px 10px rgba(0,0,0,0.06)",
                  border: "1px solid rgba(255,255,255,0.6)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${cat.color}18` }}
                >
                  <cat.Icon size={16} style={{ color: cat.color }} strokeWidth={2.3} />
                </div>
                <span className="text-[11px] font-extrabold text-text-main leading-none">
                  {cat.label}
                </span>
                <span className="text-[9.5px] font-bold text-text-light leading-none">
                  {cat.sub}
                </span>
              </Link>
            ))}
          </div>

          {/* 강한 CTA — 무조건 누를 수 있는 톤 */}
          <Link
            href="/protection"
            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[13px] font-extrabold text-white active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #D85555 0%, #B83A2A 100%)",
              boxShadow: "0 6px 18px rgba(216,85,85,0.35)",
            }}
          >
            <BookOpen size={14} />
            구조 매뉴얼 전체 펼치기
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* ── 꿀팁 헤더 ── */}
      <div className="px-4 mb-2.5">
        <div className="flex items-center gap-1.5 px-1">
          <Sparkles size={14} className="text-primary" />
          <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
            꿀팁
          </h2>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="px-4">
        {items.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl bg-white"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <Sparkles size={36} strokeWidth={1.2} className="mx-auto mb-3 text-text-light opacity-30" />
            <p className="text-[13px] text-text-sub font-semibold">아직 등록된 꿀팁이 없어요</p>
            <p className="text-[11px] text-text-light mt-1">
              곧 유용한 길고양이 돌봄 정보를 올려드릴게요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((tip) => (
              <TipCard key={tip.id} tip={tip} />
            ))}
          </div>
        )}

        {/* ── 도시공존 미니 소개 ── */}
        <div
          className="mt-6 p-5 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #FBF8F3 0%, #F2EBE0 100%)",
            border: "1px solid rgba(196,126,90,0.15)",
          }}
        >
          <p className="text-[12px] font-extrabold text-primary mb-1.5">도시공존이란?</p>
          <p className="text-[13px] text-text-main leading-relaxed mb-3">
            우리 동네 길고양이 지도, 돌봄다이어리, TNR 신청, 동네 채팅을 한곳에서
            할 수 있는 시민 참여 플랫폼이에요.
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-1 text-[12px] font-extrabold text-primary"
          >
            자세히 보기
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// 모든 글에 동일한 큰 카드. featured/pinned는 뱃지로만 구분.
function TipCard({ tip }: { tip: Tip }) {
  const photo = sanitizeImageUrl(tip.thumbnail_url, "");
  const reading = estimateReadingMinutes(tip.body);

  return (
    <Link href={`/tips/${tip.slug}`} className="block">
      <article
        className="rounded-2xl overflow-hidden bg-white active:scale-[0.99] transition-transform"
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
      >
        <div className="relative w-full aspect-[16/9] bg-[#EEE8E0]">
          {photo ? (
            <Image
              src={photo}
              alt={tip.title}
              fill
              sizes="(max-width: 720px) 100vw, 720px"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles size={42} strokeWidth={1.4} className="text-primary opacity-40" />
            </div>
          )}
          {tip.featured && (
            <span
              className="absolute top-3 left-3 text-[10px] font-extrabold px-2 py-0.5 rounded-md text-white"
              style={{ background: "rgba(196,126,90,0.95)" }}
            >
              ✨ 추천
            </span>
          )}
          {tip.pinned && (
            <span className="absolute top-3 right-3 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-white/90 text-primary inline-flex items-center gap-0.5">
              <Pin size={10} /> 고정
            </span>
          )}
        </div>
        <div className="p-4">
          {tip.tags.length > 0 && (
            <div className="flex gap-1 mb-1.5 flex-wrap">
              {tip.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: "#F2EBE0", color: "#8B6F4E" }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <h2 className="text-[16px] font-extrabold text-text-main leading-snug line-clamp-2">
            {tip.title}
          </h2>
          {tip.description && (
            <p className="text-[12.5px] text-text-sub line-clamp-2 mt-1.5 leading-snug">
              {tip.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2.5 text-[10.5px] text-text-light">
            <span>{formatDate(tip.published_at)}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <Clock size={11} /> {reading}분
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <Eye size={11} /> {tip.view_count}
            </span>
            {tip.source_url && (
              <span className="inline-flex items-center gap-0.5 ml-auto">
                <ExternalLink size={11} />
                출처 있음
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
