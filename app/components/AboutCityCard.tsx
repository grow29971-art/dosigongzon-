// 도시공존 소개 카드 (2026-07-15) — 쇼핑 + 비로그인 랜딩 공용
// "도시공존은 어떤 곳이에요?" 포지셔닝 + 3갈래 현황 + /about 링크.
// 2026-09-16 「익숙한 동네앱」 리디자인: 이모지·상태별 색 폐기 → 구분선 리스트 + 회색 상태 칩.
// PILLARS의 emoji·color 필드는 데이터 계약상 유지, 화면에는 그리지 않는다.

import Link from "next/link";
import { ChevronRight } from "lucide-react";

const PILLARS = [
  { emoji: "📱", name: "도시공존 앱", desc: "길집사님의 돌봄 도구", status: "서비스 중", color: "var(--color-sage)" },
  { emoji: "🔥", name: "길고양이 난로", desc: "겨울 동사를 막는 발열 기기", status: "양산 준비 중", color: "var(--color-care)" },
  { emoji: "🏠", name: "IoT 스마트 쉼터", desc: "길 위 아이들의 스마트 은신처", status: "개발 중", color: "var(--color-primary)" },
];

export default function AboutCityCard({ className = "mb-4" }: { className?: string }) {
  return (
    <div
      className={`px-4 py-4 ${className}`}
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
    >
      <h3 className="text-[17px] font-bold text-text-main mb-1">도시공존은 어떤 곳이에요?</h3>
      <p className="text-[13px] leading-relaxed text-text-sub mb-2">
        길고양이와 도시가 함께 사는 방법을 소프트웨어부터 하드웨어까지 만들어가는 1인 메이커예요.
      </p>
      <div>
        {PILLARS.map((p, i) => (
          <div
            key={p.name}
            className="flex items-center gap-3 py-2.5"
            style={{ borderTop: i > 0 ? "1px solid var(--color-divider)" : "none" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-main leading-snug">{p.name}</p>
              <p className="text-[13px] text-text-sub mt-0.5">{p.desc}</p>
            </div>
            <span
              className="text-[11px] font-medium px-1.5 py-0.5 shrink-0 text-text-sub"
              style={{ borderRadius: "var(--radius-square)", border: "1px solid var(--color-border)" }}
            >
              {p.status}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/about"
        className="mt-1 pt-2.5 flex items-center justify-center gap-0.5 text-[13px] font-semibold press transition-transform"
        style={{ color: "var(--color-primary)", borderTop: "1px solid var(--color-divider)" }}
      >
        도시공존 이야기 더 보기 <ChevronRight size={14} />
      </Link>
    </div>
  );
}
