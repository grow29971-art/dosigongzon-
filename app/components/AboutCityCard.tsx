// 도시공존 소개 카드 (2026-07-15) — 쇼핑 + 비로그인 랜딩 공용
// "도시공존은 어떤 곳이에요?" 포지셔닝 + 3갈래 현황 + /about 링크.

import Link from "next/link";
import { ChevronRight } from "lucide-react";

const PILLARS = [
  { emoji: "📱", name: "도시공존 앱", desc: "길집사님의 돌봄 도구", status: "서비스 중", color: "#22A366" },
  { emoji: "🔥", name: "길고양이 난로", desc: "겨울 동사를 막는 발열 기기", status: "양산 준비 중", color: "#E8930C" },
  { emoji: "🏠", name: "IoT 스마트 쉼터", desc: "길 위 아이들의 스마트 은신처", status: "개발 중", color: "var(--color-primary)" },
];

export default function AboutCityCard({ className = "mb-4" }: { className?: string }) {
  return (
    <div
      className={`px-4 py-4 rounded-3xl ${className}`}
      style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "var(--shadow-card-sm)" }}
    >
      <h3 className="text-[14px] font-extrabold text-text-main tracking-tight mb-1">🐾 도시공존은 어떤 곳이에요?</h3>
      <p className="text-[11.5px] leading-[1.7] text-text-sub mb-3">
        이름 그대로, <b className="text-text-main">길고양이와 도시가 함께 사는 방법</b>을 만들어요.
        돌봄을 한 방향이 아니라 소프트웨어부터 하드웨어까지 여러 각도에서 풀어가는 1인 메이커예요.
      </p>
      <div className="flex flex-col gap-2">
        {PILLARS.map((p) => (
          <div key={p.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: "var(--color-surface-alt)" }}>
            <span className="text-[16px] shrink-0">{p.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-extrabold text-text-main leading-tight">{p.name}</p>
              <p className="text-[10px] text-text-light">{p.desc}</p>
            </div>
            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${p.color}18`, color: p.color }}>
              {p.status}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/about"
        className="mt-3 flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-bold active:scale-[0.98] transition-transform"
        style={{ background: "var(--color-primary-softer)", color: "var(--color-primary-dark)" }}
      >
        도시공존 이야기 더 보기 <ChevronRight size={13} />
      </Link>
    </div>
  );
}
