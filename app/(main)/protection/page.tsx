"use client";

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
  PawPrint,
} from "lucide-react";

/* ═══ 카드 데이터 ═══ */
const cards: {
  title: string;
  subtitle: string;
  Icon: typeof BookOpenText;
  iconBg: string;
  iconColor: string;
  cardGradient: string;
  type: "link" | "external" | "tel";
  href: string;
  wide?: boolean;
  full?: boolean;
  highlight?: boolean;
}[] = [
  {
    title: "돌봄 가이드",
    subtitle: "농림축산식품부 공식 돌봄 매뉴얼",
    Icon: BookOpenText,
    iconBg: "rgba(59,130,246,0.15)",
    iconColor: "#3B82F6",
    cardGradient: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
    type: "external",
    href: "https://www.mafra.go.kr/bbs/home/795/570364/artclView.do",
    wide: true,
    highlight: true,
  },
  {
    title: "구청 연락처",
    subtitle: "TNR 담당부서 바로 연결",
    Icon: Phone,
    iconBg: "rgba(20,184,166,0.15)",
    iconColor: "#14B8A6",
    cardGradient: "linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)",
    type: "tel",
    href: "tel:02-120",
  },
  {
    title: "병원 찾기",
    subtitle: "근처 협력병원 검색",
    Icon: BriefcaseMedical,
    iconBg: "rgba(249,115,22,0.15)",
    iconColor: "#F97316",
    cardGradient: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
    type: "link",
    href: "/hospitals",
  },
  {
    title: "TNR 신청",
    subtitle: "국가동물보호정보시스템 바로가기",
    Icon: Globe,
    iconBg: "rgba(255,138,101,0.15)",
    iconColor: "#FF8A65",
    cardGradient: "linear-gradient(135deg, #FFF7ED 0%, #FFE4D6 100%)",
    type: "external",
    href: "https://www.animal.go.kr",
    wide: true,
  },
  {
    title: "법률 가이드",
    subtitle: "동물보호법 · 학대/훼손 대응 매뉴얼",
    Icon: ShieldCheck,
    iconBg: "rgba(139,92,246,0.15)",
    iconColor: "#8B5CF6",
    cardGradient: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
    type: "link",
    href: "/protection/legal",
    full: true,
  },
  {
    title: "냥줍 가이드",
    subtitle: "관찰 · 체온 · 급여 3단계",
    Icon: Cat,
    iconBg: "rgba(234,179,8,0.15)",
    iconColor: "#EAB308",
    cardGradient: "linear-gradient(135deg, #FEFCE8 0%, #FEF9C3 100%)",
    type: "link",
    href: "/protection/kitten-guide",
  },
  {
    title: "응급 구조 가이드",
    subtitle: "안전확보 · 지혈 · 이송 절차",
    Icon: BriefcaseMedical,
    iconBg: "rgba(239,68,68,0.15)",
    iconColor: "#EF4444",
    cardGradient: "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)",
    type: "link",
    href: "/protection/emergency-guide",
    wide: true,
  },
  {
    title: "포획 가이드",
    subtitle: "준비물 · 설치 · 대기 · 주의사항",
    Icon: Hand,
    iconBg: "rgba(20,184,166,0.15)",
    iconColor: "#14B8A6",
    cardGradient: "linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)",
    type: "link",
    href: "/protection/trapping-guide",
    full: true,
  },
];

/* ═══ 카드 컴포넌트 ═══ */
function InfoCard({ card }: { card: (typeof cards)[number] }) {
  const inner = (
    <div
      className="relative overflow-hidden p-5"
      style={{
        background: card.cardGradient,
        borderRadius: 24,
        boxShadow: "6px 6px 16px rgba(0,0,0,0.04), -4px -4px 12px rgba(255,255,255,0.8)",
        border: card.highlight ? "1.5px solid rgba(255,138,101,0.35)" : "1px solid rgba(255,255,255,0.6)",
      }}
    >
      {/* 배경 발바닥 패턴 */}
      <div className="absolute -right-3 -bottom-3 opacity-[0.04]">
        <PawPrint size={80} color={card.iconColor} strokeWidth={1} />
      </div>

      <div className="flex items-center gap-4 relative z-10">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: card.iconBg }}
        >
          <card.Icon size={24} color={card.iconColor} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-text-main">{card.title}</p>
          <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed truncate">
            {card.subtitle}
          </p>
        </div>
        <ChevronRight size={18} className="text-text-muted shrink-0" />
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

/* ═══ 페이지 ═══ */
export default function ProtectionPage() {
  const row1 = cards.slice(0, 1);
  const row2 = cards.slice(1, 3);
  const row3 = cards.slice(3, 4);
  const row4 = cards.slice(4, 5);
  const row5a = cards.slice(5, 6);
  const row5b = cards.slice(6, 7);
  const row6 = cards.slice(7, 8);

  return (
    <div className="px-4 pt-14 pb-8">
      {/* ── 헤더 ── */}
      <div className="text-center mb-6">
        <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
          보호지침
        </h1>
        <p className="text-[13px] text-text-sub mt-1">
          길고양이 보호에 필요한 모든 정보
        </p>
      </div>

      {/* ── 벤토 그리드 ── */}
      <div className="space-y-3">
        {row1.map((c) => (
          <InfoCard key={c.title} card={c} />
        ))}

        <div className="grid grid-cols-2 gap-3">
          {row2.map((c) => (
            <InfoCard key={c.title} card={c} />
          ))}
        </div>

        {row3.map((c) => (
          <InfoCard key={c.title} card={c} />
        ))}

        {row4.map((c) => (
          <InfoCard key={c.title} card={c} />
        ))}

        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-2">
            {row5a.map((c) => (
              <InfoCard key={c.title} card={c} />
            ))}
          </div>
          <div className="col-span-3">
            {row5b.map((c) => (
              <InfoCard key={c.title} card={c} />
            ))}
          </div>
        </div>

        {row6.map((c) => (
          <InfoCard key={c.title} card={c} />
        ))}
      </div>

      {/* ── 긴급 연락처 ── */}
      <div className="mt-6">
        <h2 className="text-[15px] font-bold text-text-main mb-3 px-1">
          긴급 연락처
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <a
            href="tel:112"
            className="p-4 flex flex-col items-center active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)",
              borderRadius: 24,
              boxShadow: "6px 6px 16px rgba(0,0,0,0.04), -4px -4px 12px rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.6)",
            }}
          >
            <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center mb-2">
              <span className="text-lg">🚔</span>
            </div>
            <p className="text-[13px] font-semibold text-text-main">경찰</p>
            <p className="text-[14px] font-bold text-primary mt-0.5">112</p>
          </a>
          <a
            href="tel:1577-0954"
            className="p-4 flex flex-col items-center active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
              borderRadius: 24,
              boxShadow: "6px 6px 16px rgba(0,0,0,0.04), -4px -4px 12px rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.6)",
            }}
          >
            <div className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center mb-2">
              <span className="text-lg">🐾</span>
            </div>
            <p className="text-[13px] font-semibold text-text-main">동물보호콜센터</p>
            <p className="text-[14px] font-bold text-primary mt-0.5">1577-0954</p>
          </a>
        </div>
      </div>
    </div>
  );
}
