"use client";

// 보호지침 목록 (2026-09-16 「익숙한 동네앱」 리디자인)
// 카테고리별 틴트 아이콘 카드(벤토 그리드) → 헤어라인 구분선 리스트(회색 선 아이콘 + 제목 + 한 줄 부제 + chevron).
// 데이터·동선(외부 링크·전화·읽음 진행률)은 그대로.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpenText,
  Phone,
  BriefcaseMedical,
  Globe,
  ShieldCheck,
  Cat,
  Hand,
  ChevronRight,
  Pill,
  Utensils,
  Home as HomeIcon,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  Baby,
  Scissors,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { getProgress, getReadSlugs } from "@/lib/protection-progress";

/* ═══ 가이드 데이터 ═══ */
const cards: {
  title: string;
  subtitle: string;
  Icon: typeof BookOpenText;
  type: "link" | "external" | "tel";
  href: string;
}[] = [
  {
    title: "돌봄 가이드",
    subtitle: "2026 개정 — 농림축산식품부 공식 PDF",
    Icon: BookOpenText,
    type: "external",
    // 농식품부 동물복지정책과 「개정 길고양이 돌봄 가이드라인(수정)」 2026-05-19 게시본.
    // 이전 링크(795/577856)는 농식품부가 다른 자료로 슬롯 재활용해 농지법 PDF로 잘못 노출되던 버그였음.
    href: "https://www.mafra.go.kr/bbs/home/791/597438/download.do",
  },
  {
    title: "구청 연락처",
    subtitle: "시·군·구별 동물보호 담당부서",
    Icon: Phone,
    type: "link",
    href: "/protection/district-contacts",
  },
  {
    title: "병원 찾기",
    subtitle: "근처 협력병원 검색",
    Icon: BriefcaseMedical,
    type: "link",
    href: "/hospitals",
  },
  {
    title: "TNR 신청",
    subtitle: "국가동물보호정보시스템 바로가기",
    Icon: Globe,
    type: "external",
    href: "https://www.animal.go.kr",
  },
  {
    title: "법률 가이드",
    subtitle: "동물보호법 · 학대/훼손 대응 매뉴얼",
    Icon: ShieldCheck,
    type: "link",
    href: "/protection/legal",
  },
  {
    title: "냥줍 가이드",
    subtitle: "관찰 · 체온 · 급여 3단계",
    Icon: Cat,
    type: "link",
    href: "/protection/kitten-guide",
  },
  {
    title: "응급 구조 가이드",
    subtitle: "안전확보 · 지혈 · 이송 절차",
    Icon: BriefcaseMedical,
    type: "link",
    href: "/protection/emergency-guide",
  },
  {
    title: "포획 가이드",
    subtitle: "준비물 · 설치 · 대기 · 주의사항",
    Icon: Hand,
    type: "link",
    href: "/protection/trapping-guide",
  },
  {
    title: "질병 가이드",
    subtitle: "길고양이 흔한 10가지 질병 · 증상·대응·예방",
    Icon: Stethoscope,
    type: "link",
    href: "/protection/disease-guide",
  },
  {
    title: "약품 가이드",
    subtitle: "동물약국 영양제 · 구충제 · 상처 관리",
    Icon: Pill,
    type: "link",
    href: "/protection/pharmacy-guide",
  },
  {
    title: "먹이 가이드",
    subtitle: "주면 안 되는 음식 · 안전한 급식 원칙",
    Icon: Utensils,
    type: "link",
    href: "/protection/feeding-guide",
  },
  {
    title: "쉼터 · 겨울나기",
    subtitle: "숨숨집 DIY · 설치 원칙 · 계절 운영",
    Icon: HomeIcon,
    type: "link",
    href: "/protection/shelter-guide",
  },
  {
    title: "자주 묻는 질문",
    subtitle: "발견·구조·TNR·입양·법 — 30문 정리",
    Icon: HelpCircle,
    type: "link",
    href: "/faq",
  },
];

/* ═══ 리스트 행 ═══ */
function GuideRow({ card, isRead }: { card: (typeof cards)[number]; isRead?: boolean }) {
  const inner = (
    <>
      <div className="w-10 h-10 flex items-center justify-center shrink-0 text-text-sub">
        <card.Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[15px] font-semibold text-text-main leading-snug truncate">{card.title}</p>
          {isRead && (
            <CheckCircle2
              size={14}
              className="shrink-0"
              style={{ color: "var(--color-sage)" }}
              aria-label="읽음"
            />
          )}
        </div>
        <p className="text-[13px] text-text-sub leading-snug mt-0.5 truncate">{card.subtitle}</p>
      </div>
      {card.type === "external" ? (
        <ExternalLink size={16} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
      ) : (
        <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
      )}
    </>
  );

  const className =
    "flex items-center gap-3 px-1 py-3 border-b border-divider last:border-b-0 press";
  const style = { minHeight: 64 };

  if (card.type === "link") {
    return (
      <Link href={card.href} className={className} style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <a
      href={card.href}
      target={card.type === "external" ? "_blank" : undefined}
      rel={card.type === "external" ? "noopener noreferrer" : undefined}
      className={className}
      style={style}
    >
      {inner}
    </a>
  );
}

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "도시공존", item: "https://dosigongzon.com" },
    { "@type": "ListItem", position: 2, name: "보호지침", item: "https://dosigongzon.com/protection" },
  ],
};

/* ═══ 상황별 빠른 진입 칩 ═══ */
const QUICK_SITUATIONS = [
  { label: "다친 아이 발견", icon: AlertTriangle, href: "/protection/emergency-guide" },
  { label: "새끼를 봤어요", icon: Baby, href: "/protection/kitten-guide" },
  { label: "먹이 줘도 되나?", icon: Utensils, href: "/protection/feeding-guide" },
  { label: "TNR 알아보기", icon: Scissors, href: "/protection/trapping-guide" },
  { label: "쉼터 만들기", icon: HomeIcon, href: "/protection/shelter-guide" },
  { label: "약·영양제", icon: Pill, href: "/protection/pharmacy-guide" },
];

// href에서 slug 추출 ("/protection/foo" → "foo")
function slugFromHref(href: string): string | null {
  const m = href.match(/^\/protection\/([^/]+)$/);
  return m ? m[1] : null;
}

/* ═══ 페이지 ═══ */
export default function ProtectionPage() {
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ read: 0, total: 9, percent: 0 });

  useEffect(() => {
    const sync = () => {
      setReadSet(getReadSlugs());
      setProgress(getProgress());
    };
    sync();
    window.addEventListener("protection-progress-changed", sync);
    return () => window.removeEventListener("protection-progress-changed", sync);
  }, []);

  const isRead = (href: string) => {
    const slug = slugFromHref(href);
    return slug ? readSet.has(slug) : false;
  };

  const done = progress.read === progress.total;

  return (
    <div className="px-4 pt-14 pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
      />
      {/* ── 헤더 ── */}
      <div className="mb-4 px-1">
        <h1 className="text-[24px] font-bold text-text-main tracking-tight mb-1">보호지침</h1>
        <p className="text-[13px] text-text-sub leading-relaxed">
          길고양이 보호에 필요한 정보를 한 곳에
        </p>
      </div>

      {/* ── 상황별 빠른 선택 ── */}
      <div className="mb-4">
        <p className="text-[13px] font-semibold text-text-sub mb-2 px-1">지금 어떤 상황인가요?</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {QUICK_SITUATIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.label}
                href={s.href}
                className="shrink-0 inline-flex items-center gap-1 h-8 px-3 chip-square press text-[13px] font-semibold"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-sub)",
                }}
              >
                <Icon size={14} strokeWidth={2} />
                <span>{s.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── 학습 진행률 ── */}
      <div
        className="mb-4 px-4 py-3 flex items-center gap-3"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text-main">
            {done ? "9개 가이드 모두 읽었어요" : `9개 중 ${progress.read}개 읽음`}
          </p>
          <div className="progress-bar mt-1.5">
            <div
              style={{
                width: `${progress.percent}%`,
                background: done ? "var(--color-sage)" : "var(--color-primary)",
              }}
            />
          </div>
        </div>
        <span
          className="text-[13px] font-semibold tabular-nums shrink-0"
          style={{ color: done ? "var(--color-sage)" : "var(--color-primary)" }}
        >
          {progress.percent}%
        </span>
      </div>

      {/* ── 가이드 목록 ── */}
      <div>
        {cards.map((c) => (
          <GuideRow key={c.title} card={c} isRead={isRead(c.href)} />
        ))}
      </div>

      {/* ── 긴급 연락처 ── */}
      <div className="mt-6">
        <div className="mb-1 px-1">
          <h2 className="text-[17px] font-bold text-text-main tracking-tight">긴급 연락처</h2>
        </div>
        <div>
          {EMERGENCY_CONTACTS.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.label}
                href={`tel:${c.tel}`}
                className="flex items-center gap-3 px-1 py-3 border-b border-divider last:border-b-0 press"
                style={{ minHeight: 56 }}
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0 text-text-sub">
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <p className="flex-1 min-w-0 text-[15px] font-semibold text-text-main truncate">{c.label}</p>
                <span className="text-[14px] font-medium tabular-nums shrink-0" style={{ color: "var(--color-primary)" }}>
                  {c.tel}
                </span>
              </a>
            );
          })}
        </div>
        <p className="text-[11px] text-text-light mt-2 px-1 leading-relaxed">
          학대 현장 목격 시 경찰 우선 · 보호/상담은 동물권 단체
        </p>
      </div>

      {/* ── 길고양이 급식소 커뮤니티 ── */}
      <div className="mt-6 mb-4">
        <div className="mb-1 px-1">
          <h2 className="text-[17px] font-bold text-text-main tracking-tight">급식소 커뮤니티</h2>
        </div>
        <div>
          {COMMUNITY_LINKS.map((c) => (
            <a
              key={c.href}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-1 py-3 border-b border-divider last:border-b-0 press"
              style={{ minHeight: 64 }}
            >
              <div className="w-10 h-10 flex items-center justify-center shrink-0 text-text-sub">
                <Globe size={20} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-main truncate">{c.title}</p>
                <p className="text-[13px] text-text-sub mt-0.5 truncate">{c.subtitle}</p>
              </div>
              <span className="text-[11px] font-semibold shrink-0" style={{ color: "#03C75A" }}>
                NAVER
              </span>
              <ExternalLink size={16} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ 긴급 연락처 데이터 ═══ */
const EMERGENCY_CONTACTS = [
  { label: "경찰", tel: "112", icon: Phone },
  { label: "카라", tel: "02-3482-0999", icon: Phone },
  { label: "케어", tel: "02-313-8886", icon: Phone },
  { label: "고보협", tel: "070-7426-4888", icon: Phone },
];

/* ═══ 급식소 커뮤니티 링크 ═══ */
const COMMUNITY_LINKS = [
  {
    href: "https://cafe.naver.com/icfc0520",
    title: "길냥이 급식소",
    subtitle: "네이버 카페 · 길고양이 급식 정보 공유",
  },
  {
    href: "https://cafe.naver.com/caretaker",
    title: "길고양이 급식소",
    subtitle: "네이버 카페 · 전국 급식소 위치 및 운영",
  },
];
