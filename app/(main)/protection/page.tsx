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
} from "lucide-react";

/* ═══ 카드 데이터 ═══ */
const cards: {
  title: string;
  subtitle: string;
  Icon: typeof BookOpenText;
  iconBg: string;
  iconColor: string;
  type: "link" | "external" | "tel";
  href: string;
  wide?: boolean;
  full?: boolean;
}[] = [
  {
    title: "돌봄 가이드",
    subtitle: "농림축산식품부 공식 PDF",
    Icon: BookOpenText,
    iconBg: "#DBEAFE",
    iconColor: "#3B82F6",
    type: "external",
    href: "https://www.mafra.go.kr/bbs/home/795/570364/artclView.do",
    wide: true,
  },
  {
    title: "구청 연락처",
    subtitle: "TNR 담당",
    Icon: Phone,
    iconBg: "#CCFBF1",
    iconColor: "#14B8A6",
    type: "tel",
    href: "tel:02-120",
  },
  {
    title: "병원 찾기",
    subtitle: "근처 검색",
    Icon: BriefcaseMedical,
    iconBg: "#FFEDD5",
    iconColor: "#F97316",
    type: "link",
    href: "/hospitals",
  },
  {
    title: "TNR 신청",
    subtitle: "국가동물보호정보시스템",
    Icon: Globe,
    iconBg: "#FFEDD5",
    iconColor: "#FF8A65",
    type: "external",
    href: "https://www.animal.go.kr",
    wide: true,
  },
  {
    title: "법률 가이드",
    subtitle: "학대/훼손 대응 · 동물보호법 안내",
    Icon: ShieldCheck,
    iconBg: "#EDE9FE",
    iconColor: "#8B5CF6",
    type: "link",
    href: "/protection/legal",
    full: true,
  },
  {
    title: "냥줍 가이드",
    subtitle: "관찰 · 체온 · 급여",
    Icon: Cat,
    iconBg: "#FEF9C3",
    iconColor: "#EAB308",
    type: "link",
    href: "/protection/kitten-guide",
  },
  {
    title: "응급 구조 가이드",
    subtitle: "안전확보 · 지혈 · 이송",
    Icon: BriefcaseMedical,
    iconBg: "#FEE2E2",
    iconColor: "#EF4444",
    type: "link",
    href: "/protection/emergency-guide",
    wide: true,
  },
  {
    title: "포획 가이드",
    subtitle: "준비물 · 설치 · 대기 · 주의사항",
    Icon: Hand,
    iconBg: "#CCFBF1",
    iconColor: "#14B8A6",
    type: "link",
    href: "/protection/trapping-guide",
    full: true,
  },
];

/* ═══ 카드 컴포넌트 ═══ */
function InfoCard({ card }: { card: typeof cards[number] }) {
  const inner = (
    <div className="flex items-center gap-4 p-5">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: card.iconBg }}
      >
        <card.Icon size={24} color={card.iconColor} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-text-main">{card.title}</p>
        <p className="text-[12px] text-text-sub mt-0.5 truncate">{card.subtitle}</p>
      </div>
      <ChevronRight size={18} className="text-text-muted shrink-0" />
    </div>
  );

  const className = "block bg-white rounded-[28px] shadow-[0_2px_16px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-transform";

  if (card.type === "link") {
    return <Link href={card.href} className={className}>{inner}</Link>;
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
  // 벤토 레이아웃을 위해 행별로 분리
  const row1 = cards.slice(0, 1); // 돌봄 가이드 (wide)
  const row2 = cards.slice(1, 3); // 구청 연락처, 병원 찾기 (2col)
  const row3 = cards.slice(3, 4); // TNR 신청 (wide)
  const row4 = cards.slice(4, 5); // 법률 가이드 (full)
  const row5a = cards.slice(5, 6); // 냥줍 가이드
  const row5b = cards.slice(6, 7); // 응급 구조 가이드 (wide)
  const row6 = cards.slice(7, 8); // 포획 가이드 (full)

  return (
    <div className="px-4 pt-14 pb-8">
      {/* ── 헤더 ── */}
      <div className="text-center mb-6">
        <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">보호지침</h1>
        <p className="text-[13px] text-text-sub mt-1">길고양이 보호에 필요한 모든 정보</p>
      </div>

      {/* ── 벤토 그리드 ── */}
      <div className="space-y-3">
        {/* Row 1: 돌봄 가이드 (wide) */}
        {row1.map((c) => (
          <InfoCard key={c.title} card={c} />
        ))}

        {/* Row 2: 구청 연락처 + 병원 찾기 (2col) */}
        <div className="grid grid-cols-2 gap-3">
          {row2.map((c) => (
            <InfoCard key={c.title} card={c} />
          ))}
        </div>

        {/* Row 3: TNR 신청 (wide) */}
        {row3.map((c) => (
          <InfoCard key={c.title} card={c} />
        ))}

        {/* Row 4: 법률 가이드 (full) */}
        {row4.map((c) => (
          <InfoCard key={c.title} card={c} />
        ))}

        {/* Row 5: 냥줍 + 응급 구조 (2col flex) */}
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

        {/* Row 6: 포획 가이드 (full) */}
        {row6.map((c) => (
          <InfoCard key={c.title} card={c} />
        ))}
      </div>

      {/* ── 긴급 연락처 ── */}
      <div className="mt-6">
        <h2 className="text-[15px] font-bold text-text-main mb-3 px-1">긴급 연락처</h2>
        <div className="grid grid-cols-2 gap-3">
          <a href="tel:112" className="bg-white rounded-[24px] p-4 flex flex-col items-center shadow-[0_2px_16px_rgba(0,0,0,0.04)] active:scale-95 transition-transform">
            <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mb-2">
              <span className="text-lg">🚔</span>
            </div>
            <p className="text-[13px] font-semibold text-text-main">경찰</p>
            <p className="text-sm font-bold text-primary mt-0.5">112</p>
          </a>
          <a href="tel:1577-0954" className="bg-white rounded-[24px] p-4 flex flex-col items-center shadow-[0_2px_16px_rgba(0,0,0,0.04)] active:scale-95 transition-transform">
            <div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center mb-2">
              <span className="text-lg">🐾</span>
            </div>
            <p className="text-[13px] font-semibold text-text-main">동물보호콜센터</p>
            <p className="text-sm font-bold text-primary mt-0.5">1577-0954</p>
          </a>
        </div>
      </div>
    </div>
  );
}
