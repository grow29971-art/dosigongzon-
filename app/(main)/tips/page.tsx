// 꿀팁게시판 인덱스 — /tips
// 길고양이 돌봄·TNR·입양에 도움되는 정보글 큐레이션.
// 서버 컴포넌트, 10분 ISR.

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Sparkles, ChevronRight, Eye, Clock, ExternalLink, Pin, BookOpen, Bot, Siren, Baby, Stethoscope, Snowflake, Pill, Heart, Phone, Scale, AlertTriangle } from "lucide-react";
import { listPublishedTipsServer, type Tip } from "@/lib/tips-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import PageIntroModal from "@/app/components/PageIntroModal";
import { estimateReadingMinutes } from "@/lib/html-sanitize";
import TipsAdminFab from "./TipsAdminFab";
import TipsAIButler from "./TipsAIButler";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "AI집사 · 돌봄 가이드 — 도시공존",
  description:
    "길고양이 돌봄, 뭐든 AI 집사에게 물어보세요. TNR·구조·입양 가이드와 도시공존이 직접 큐레이션한 꿀팁까지 한곳에서.",
  keywords: [
    "길고양이 꿀팁", "길고양이 돌봄법", "TNR 신청", "중성화", "임시보호",
    "고양이 구조", "겨울철 길고양이", "길집사 꿀팁", "도시공존 꿀팁 매거진",
  ],
  alternates: { canonical: "/tips" },
  openGraph: {
    title: "AI집사 · 돌봄 가이드 | 도시공존",
    description: "길고양이 돌봄, 뭐든 AI 집사에게 물어보세요.",
    url: "https://dosigongzon.com/tips",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI집사 · 돌봄 가이드 | 도시공존",
    description: "길고양이 돌봄, 뭐든 AI 집사에게 물어보세요.",
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
    name: "도시공존 꿀팁 매거진",
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
    <div className="pb-24" style={{ background: "var(--color-surface)", minHeight: "100vh" }}>
      <PageIntroModal
        storageKey="dosigongzon_intro_tips"
        badge="AI 집사"
        headerEmoji=""
        title="궁금한 건 AI 집사에게 물어보세요"
        items={[
          { emoji: "", text: <>응급처치·TNR·사료·겨울나기… 무엇이든 <b className="text-text-main">24시간</b> 답해줘요.</> },
          { emoji: "", text: <>상황별 보호 가이드도 이 곳에 모여 있어요.</> },
          { emoji: "", text: <>급하거나 의료 판단이 필요하면 꼭 <b className="text-text-main">실제 수의사</b>와 상의하세요.</> },
        ]}
      />
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
          className="w-9 h-9 -ml-2 flex items-center justify-center press-strong"
          aria-label="홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <div>
          <h1 className="text-[20px] font-bold text-text-main tracking-tight flex items-center gap-1.5">
            <Bot size={18} className="text-text-sub" />
            AI집사
          </h1>
          <p className="text-[11px] text-text-sub">궁금한 건 AI 집사에게 — 구조 매뉴얼·꿀팁 매거진도 한곳에</p>
        </div>
      </div>

      {/* ── AI 집사 — 탭 이름이 AI집사라 최상단 배치 (2026-07-11) ── */}
      <TipsAIButler />

      {/* ── 보호지침 매뉴얼 (꿀팁과 통합) — 위급할 땐 여기 펼치기 ── */}
      <div className="px-4 mb-5">
        <div className="px-1">

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={15} style={{ color: "var(--color-error)" }} />
              <h2 className="text-[17px] font-bold tracking-tight text-text-main">
                위급할 땐 여기로
              </h2>
            </div>
            <span className="text-[11px] font-medium text-text-light">구조 매뉴얼</span>
          </div>
          <p className="text-[13px] leading-snug mb-3 text-text-sub">
            응급·새끼 발견·TNR·법률까지 — 한 발 빠른 대처가 한 생명을 살려요
          </p>

          {/* 3×3 카테고리 grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { href: "/protection/emergency-guide", label: "응급처치", sub: "다쳤을 때", Icon: Siren },
              { href: "/protection/kitten-guide", label: "새끼 발견", sub: "이런 땐 데려와요", Icon: Baby },
              { href: "/protection/disease-guide", label: "질병 신호", sub: "증상 체크", Icon: Heart },
              { href: "/protection/trapping-guide", label: "TNR·포획", sub: "안전한 절차", Icon: Stethoscope },
              { href: "/protection/feeding-guide", label: "밥주기", sub: "올바른 방법", Icon: Sparkles },
              { href: "/protection/shelter-guide", label: "겨울 쉼터", sub: "지금 만들기", Icon: Snowflake },
              { href: "/protection/pharmacy-guide", label: "약품 안내", sub: "주변 약국", Icon: Pill },
              { href: "/protection/district-contacts", label: "지자체 연락", sub: "전국 240+ 곳", Icon: Phone },
              { href: "/protection/legal", label: "법률·신고", sub: "학대 대응", Icon: Scale },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="rounded-xl px-2 py-2.5 flex flex-col items-center gap-1 press-strong transition-transform"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  className="w-9 h-9 flex items-center justify-center shrink-0 text-text-sub"
                >
                  <cat.Icon size={18} strokeWidth={1.8} />
                </div>
                <span className="text-[11px] font-bold text-text-main leading-none">
                  {cat.label}
                </span>
                <span className="text-[11px] text-text-light leading-none">
                  {cat.sub}
                </span>
              </Link>
            ))}
          </div>

          {/* 강한 CTA — 무조건 누를 수 있는 톤 */}
          <Link
            href="/protection"
            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-lg text-[13px] font-semibold bg-gray-100 text-text-main press transition-transform"
          >
            <BookOpen size={14} />
            구조 매뉴얼 전체 펼치기
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* ── 꿀팁 매거진 헤더 (토스식 17px 위계) ── */}
      <div className="px-4 mb-2.5">
        <div className="flex items-center gap-1.5 px-1">
          <Sparkles size={15} className="text-text-sub" />
          <h2 className="text-[17px] font-bold text-text-main tracking-tight">
            도시공존 꿀팁 매거진
          </h2>
        </div>
      </div>

      {/* ── 인기 태그 ── */}
      {popularTags.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
            {popularTags.map((tag) => (
              <Link
                key={tag}
                href={`/tips?tag=${encodeURIComponent(tag)}`}
                className="shrink-0 text-[13px] font-bold px-2.5 py-1 chip-square bg-white text-text-sub border border-border press-strong transition-transform"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 본문 ── */}
      <div className="px-4">
        {items.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl bg-white"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <Sparkles size={36} strokeWidth={1.2} className="mx-auto mb-3 text-text-light opacity-30" />
            <p className="text-[13px] text-text-sub font-semibold">아직 등록된 꿀팁이 없어요</p>
            <p className="text-[11px] text-text-light mt-1">
              곧 유용한 길고양이 돌봄 정보를 올려드릴게요
            </p>
          </div>
        ) : (
          <div>
            {items.map((tip) => (
              <TipCard key={tip.id} tip={tip} />
            ))}
          </div>
        )}

        {/* ── 도시공존 미니 소개 ── */}
        <div
          className="mt-6 p-5 rounded-xl"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-[13px] font-bold text-primary mb-1.5">도시공존이란?</p>
          <p className="text-[13px] text-text-main leading-relaxed mb-3">
            우리 동네 길고양이 지도, 돌봄다이어리, TNR 신청, 동네 채팅을 한곳에서
            할 수 있는 시민 참여 플랫폼이에요.
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-1 text-[13px] font-bold text-primary"
          >
            자세히 보기
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// 구분선 리스트 행 — 썸네일 8px 둥근 사각(72px) + 제목/요약/메타. featured/pinned는 작은 텍스트 배지.
function TipCard({ tip }: { tip: Tip }) {
  const photo = sanitizeImageUrl(tip.thumbnail_url, "");
  const reading = estimateReadingMinutes(tip.body);

  return (
    <Link
      href={`/tips/${tip.slug}`}
      className="flex gap-3 py-3 border-b border-divider last:border-b-0 press transition-transform"
    >
      <div className="flex-1 min-w-0">
        {(tip.featured || tip.pinned || tip.tags.length > 0) && (
          <div className="flex gap-1.5 mb-1 flex-wrap items-center">
            {tip.pinned && (
              <span className="text-[11px] font-semibold text-text-light inline-flex items-center gap-0.5">
                <Pin size={10} /> 고정
              </span>
            )}
            {tip.featured && (
              <span className="text-[11px] font-semibold" style={{ color: "var(--color-primary)" }}>추천</span>
            )}
            {tip.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[11px] text-text-light">#{tag}</span>
            ))}
          </div>
        )}
        <h2 className="text-[15px] font-semibold text-text-main leading-snug line-clamp-2">
          {tip.title}
        </h2>
        {tip.description && (
          <p className="text-[13px] text-text-sub line-clamp-2 mt-1 leading-snug">
            {tip.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-light">
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
      <div
        className="relative shrink-0 overflow-hidden rounded-lg flex items-center justify-center"
        style={{ width: 72, height: 72, background: "var(--color-gray-100)" }}
      >
        {photo ? (
          <Image src={photo} alt={tip.title} fill sizes="72px" style={{ objectFit: "cover" }} />
        ) : (
          <Sparkles size={20} strokeWidth={1.4} className="text-text-light" />
        )}
      </div>
    </Link>
  );
}
