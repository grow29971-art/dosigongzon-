"use client";

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
  Siren,
  Heart,
  HeartHandshake,
  Utensils,
  Home as HomeIcon,
  Stethoscope,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Baby,
  Scissors,
} from "lucide-react";
import { getProgress, getReadSlugs } from "@/lib/protection-progress";

/* ═══ 카드 데이터 ═══ */
const cards: {
  title: string;
  subtitle: string;
  Icon: typeof BookOpenText;
  iconBg: string;
  iconColor: string;
  glowColor: string;
  type: "link" | "external" | "tel";
  href: string;
  wide?: boolean;
  full?: boolean;
  highlight?: boolean;
}[] = [
  {
    title: "돌봄 가이드",
    subtitle: "농림축산식품부 공식 PDF 매뉴얼",
    Icon: BookOpenText,
    iconBg: "#4A7BA8",
    iconColor: "#FFFFFF",
    glowColor: "74,123,168",
    type: "external",
    href: "https://www.mafra.go.kr/bbs/home/795/577856/download.do",
    wide: true,
    highlight: true,
  },
  {
    title: "구청 연락처",
    subtitle: "시·군·구별 동물보호 담당부서",
    Icon: Phone,
    iconBg: "#5BA876",
    iconColor: "#FFFFFF",
    glowColor: "91,168,118",
    type: "link",
    href: "/protection/district-contacts",
  },
  {
    title: "병원 찾기",
    subtitle: "근처 협력병원 검색",
    Icon: BriefcaseMedical,
    iconBg: "#E88D5A",
    iconColor: "#FFFFFF",
    glowColor: "232,141,90",
    type: "link",
    href: "/hospitals",
  },
  {
    title: "TNR 신청",
    subtitle: "국가동물보호정보시스템 바로가기",
    Icon: Globe,
    iconBg: "#48A59E",
    iconColor: "#FFFFFF",
    glowColor: "72,165,158",
    type: "external",
    href: "https://www.animal.go.kr",
    wide: true,
  },
  {
    title: "법률 가이드",
    subtitle: "동물보호법 · 학대/훼손 대응 매뉴얼",
    Icon: ShieldCheck,
    iconBg: "#8B65B8",
    iconColor: "#FFFFFF",
    glowColor: "139,101,184",
    type: "link",
    href: "/protection/legal",
    full: true,
  },
  {
    title: "냥줍 가이드",
    subtitle: "관찰 · 체온 · 급여 3단계",
    Icon: Cat,
    iconBg: "#E8B040",
    iconColor: "#FFFFFF",
    glowColor: "232,176,64",
    type: "link",
    href: "/protection/kitten-guide",
  },
  {
    title: "응급 구조 가이드",
    subtitle: "안전확보 · 지혈 · 이송 절차",
    Icon: BriefcaseMedical,
    iconBg: "#D85555",
    iconColor: "#FFFFFF",
    glowColor: "216,85,85",
    type: "link",
    href: "/protection/emergency-guide",
    wide: true,
  },
  {
    title: "포획 가이드",
    subtitle: "준비물 · 설치 · 대기 · 주의사항",
    Icon: Hand,
    iconBg: "#8BA86B",
    iconColor: "#FFFFFF",
    glowColor: "139,168,107",
    type: "link",
    href: "/protection/trapping-guide",
    full: true,
  },
  {
    title: "질병 가이드",
    subtitle: "길고양이 흔한 10가지 질병 · 증상·대응·예방",
    Icon: Stethoscope,
    iconBg: "#D85555",
    iconColor: "#FFFFFF",
    glowColor: "216,85,85",
    type: "link",
    href: "/protection/disease-guide",
    wide: true,
    highlight: true,
  },
  {
    title: "약품 가이드",
    subtitle: "동물약국 영양제 · 구충제 · 상처 관리",
    Icon: Pill,
    iconBg: "#D4708F",
    iconColor: "#FFFFFF",
    glowColor: "212,112,143",
    type: "link",
    href: "/protection/pharmacy-guide",
    wide: true,
    highlight: true,
  },
  {
    title: "먹이 가이드",
    subtitle: "주면 안 되는 음식 · 안전한 급식 원칙",
    Icon: Utensils,
    iconBg: "#E88D5A",
    iconColor: "#FFFFFF",
    glowColor: "232,141,90",
    type: "link",
    href: "/protection/feeding-guide",
    wide: true,
  },
  {
    title: "쉼터 · 겨울나기",
    subtitle: "숨숨집 DIY · 설치 원칙 · 계절 운영",
    Icon: HomeIcon,
    iconBg: "#4A7BA8",
    iconColor: "#FFFFFF",
    glowColor: "74,123,168",
    type: "link",
    href: "/protection/shelter-guide",
    wide: true,
  },
];

/* ═══ 카드 컴포넌트 ═══ */
function InfoCard({ card, isRead }: { card: (typeof cards)[number]; isRead?: boolean }) {
  const inner = (
    <div
      className="relative overflow-hidden px-5 py-[18px]"
      style={{
        background: "#FFFFFF",
        borderRadius: 22,
        boxShadow: card.highlight
          ? `0 12px 32px rgba(${card.glowColor},0.18), 0 2px 6px rgba(${card.glowColor},0.08)`
          : `0 6px 20px rgba(${card.glowColor},0.10), 0 1px 3px rgba(0,0,0,0.03)`,
        border: card.highlight
          ? `1.5px solid rgba(${card.glowColor},0.30)`
          : "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center gap-4 relative z-10">
        {/* 아이콘: 컬러 bg + 광택 + glow */}
        <div
          className="w-[48px] h-[48px] rounded-2xl flex items-center justify-center shrink-0 relative dark-icon-box"
          style={{ backgroundColor: `${card.iconBg}15` }}
        >
          <card.Icon size={22} color={card.iconBg} strokeWidth={2} />
          {isRead && (
            <div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: "#5BA876", border: "1.5px solid #fff" }}
            >
              <CheckCircle2 size={10} color="#fff" strokeWidth={3} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15.5px] font-extrabold text-text-main tracking-tight leading-tight">
            {card.title}
          </p>
        </div>
        <ChevronRight
          size={18}
          strokeWidth={2.5}
          className="shrink-0"
          style={{ color: card.iconBg, opacity: 0.7 }}
        />
      </div>
    </div>
  );

  const className = "block active:scale-[0.98] transition-transform";

  if (card.type === "link") {
    return (
      <Link href={card.href} className={className}>
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
  { label: "다친 아이 발견", icon: AlertTriangle, color: "#D85555", href: "/protection/emergency-guide" },
  { label: "새끼를 봤어요", icon: Baby, color: "#E8B040", href: "/protection/kitten-guide" },
  { label: "먹이 줘도 되나?", icon: Utensils, color: "#E88D5A", href: "/protection/feeding-guide" },
  { label: "TNR 알아보기", icon: Scissors, color: "#8BA86B", href: "/protection/trapping-guide" },
  { label: "쉼터 만들기", icon: HomeIcon, color: "#4A7BA8", href: "/protection/shelter-guide" },
  { label: "약·영양제", icon: Pill, color: "#D4708F", href: "/protection/pharmacy-guide" },
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

  const row1 = cards.slice(0, 1);
  const row2 = cards.slice(1, 3);
  const row3 = cards.slice(3, 4);
  const row4 = cards.slice(4, 5);
  const row5a = cards.slice(5, 6);
  const row5b = cards.slice(6, 7);
  const row6 = cards.slice(7, 8);
  const row7 = cards.slice(8, 9);

  return (
    <div className="px-4 pt-14 pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {/* ── 헤더 ── */}
      <div className="mb-4 px-1">
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[24px] font-extrabold text-text-main tracking-tight">
            보호지침
          </h1>
          <span className="text-[11px] font-semibold text-text-light">
            Protection Guide
          </span>
        </div>
        <p className="text-[12.5px] text-text-sub leading-relaxed">
          길고양이 보호에 필요한 모든 정보를 한 곳에
        </p>
      </div>

      {/* ── 상황별 빠른 선택 ── */}
      <div className="mb-4">
        <p className="text-[11px] font-bold text-text-sub mb-2 px-1">지금 어떤 상황인가요?</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {QUICK_SITUATIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.label}
                href={s.href}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full active:scale-95 transition-transform"
                style={{
                  background: `${s.color}10`,
                  border: `1px solid ${s.color}30`,
                }}
              >
                <Icon size={13} color={s.color} strokeWidth={2.4} />
                <span className="text-[12px] font-bold" style={{ color: s.color }}>
                  {s.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── 학습 진행률 ── */}
      <div
        className="mb-5 rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{
          background: progress.read === progress.total
            ? "linear-gradient(135deg, #E8F4E8 0%, #D5EDD5 100%)"
            : "linear-gradient(135deg, #FFF8F2 0%, #FCEFD9 100%)",
          border: `1px solid ${progress.read === progress.total ? "#5BA87633" : "rgba(196,126,90,0.18)"}`,
        }}
      >
        <Sparkles size={16} className={progress.read === progress.total ? "text-[#3F5B42]" : "text-[#C47E5A]"} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-extrabold text-text-main">
            {progress.read === progress.total
              ? "9개 가이드 모두 학습 완료! 🎉"
              : `9개 중 ${progress.read}개 학습`}
          </p>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress.percent}%`,
                background: progress.read === progress.total ? "#5BA876" : "#C47E5A",
              }}
            />
          </div>
        </div>
        <span className="text-[12px] font-extrabold tabular-nums" style={{ color: progress.read === progress.total ? "#3F5B42" : "#C47E5A" }}>
          {progress.percent}%
        </span>
      </div>

      {/* ── 벤토 그리드 ── */}
      <div className="space-y-3">
        {row1.map((c) => (
          <InfoCard key={c.title} card={c} isRead={isRead(c.href)} />
        ))}

        <div className="grid grid-cols-2 gap-3">
          {row2.map((c) => (
            <InfoCard key={c.title} card={c} isRead={isRead(c.href)} />
          ))}
        </div>

        {row3.map((c) => (
          <InfoCard key={c.title} card={c} isRead={isRead(c.href)} />
        ))}

        {row4.map((c) => (
          <InfoCard key={c.title} card={c} isRead={isRead(c.href)} />
        ))}

        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-2">
            {row5a.map((c) => (
              <InfoCard key={c.title} card={c} isRead={isRead(c.href)} />
            ))}
          </div>
          <div className="col-span-3">
            {row5b.map((c) => (
              <InfoCard key={c.title} card={c} isRead={isRead(c.href)} />
            ))}
          </div>
        </div>

        {row6.map((c) => (
          <InfoCard key={c.title} card={c} isRead={isRead(c.href)} />
        ))}

        {row7.map((c) => (
          <InfoCard key={c.title} card={c} isRead={isRead(c.href)} />
        ))}
      </div>

      {/* ── 긴급 연락처 ── */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#B84545" }} />
          <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
            긴급 연락처
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {EMERGENCY_CONTACTS.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.label}
                href={`tel:${c.tel}`}
                className="py-4 px-2 flex flex-col items-center active:scale-95 transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${c.accent}12 0%, ${c.accent}08 100%)`,
                  borderRadius: 20,
                  border: `1.5px solid ${c.accent}20`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                  style={{ backgroundColor: `${c.accent}15` }}
                >
                  <Icon size={20} color={c.accent} strokeWidth={2} />
                </div>
                <p className="text-[12px] font-extrabold text-text-main tracking-tight">
                  {c.label}
                </p>
                <p
                  className="text-[10.5px] font-bold mt-0.5 tracking-tight"
                  style={{ color: c.accent }}
                >
                  {c.tel}
                </p>
              </a>
            );
          })}
        </div>
        <p className="text-[10.5px] text-text-light mt-2.5 px-1 leading-relaxed">
          학대 현장 목격 시 경찰 우선 · 보호/상담은 동물권 단체
        </p>
      </div>

      {/* ── 길고양이 급식소 커뮤니티 ── */}
      <div className="mt-6 mb-4">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#03C75A" }} />
          <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
            급식소 커뮤니티
          </h2>
        </div>
        <div className="space-y-2">
          <a
            href="https://cafe.naver.com/icfc0520"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
            style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(3,199,90,0.1)" }}>
              <span className="text-[18px]">🍚</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-text-main">길냥이 급식소</p>
              <p className="text-[11px] text-text-sub mt-0.5">네이버 카페 · 길고양이 급식 정보 공유</p>
            </div>
            <span className="text-[11px] font-bold shrink-0" style={{ color: "#03C75A" }}>NAVER →</span>
          </a>
          <a
            href="https://cafe.naver.com/caretaker"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
            style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(3,199,90,0.1)" }}>
              <span className="text-[18px]">🐱</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-text-main">길고양이 급식소</p>
              <p className="text-[11px] text-text-sub mt-0.5">네이버 카페 · 전국 급식소 위치 및 운영</p>
            </div>
            <span className="text-[11px] font-bold shrink-0" style={{ color: "#03C75A" }}>NAVER →</span>
          </a>
        </div>
      </div>
    </div>
  );
}

/* ═══ 긴급 연락처 데이터 ═══ */
const EMERGENCY_CONTACTS = [
  {
    label: "경찰",
    tel: "112",
    icon: Siren,
    accent: "#D85555",
  },
  {
    label: "카라",
    tel: "02-3482-0999",
    icon: Heart,
    accent: "#5BA876",
  },
  {
    label: "케어",
    tel: "02-313-8886",
    icon: HeartHandshake,
    accent: "#E88D5A",
  },
];
