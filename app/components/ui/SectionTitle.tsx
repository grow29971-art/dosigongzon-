// 공존 디자인 시스템 — 확인서(보고서) 절 제목 (2026-09-16 리디자인 접합부 중복 부품 승격)
// 돌봄 활동 확인서 계열 문서의 "1. 돌봄 활동 요약" 같은 절 제목. 13px 600, 아래 8px 여백.
// 순수 프리젠테이션 — "use client" 없음(서버 컴포넌트에서 그대로 쓴다).

import type { ReactNode } from "react";

export default function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[13px] font-semibold text-text-main mb-2 tracking-tight">{children}</h2>
  );
}
