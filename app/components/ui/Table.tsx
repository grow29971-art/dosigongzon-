// 공존 디자인 시스템 — 확인서(보고서) 표 셀 (2026-09-16 리디자인 접합부 중복 부품 승격)
// 인쇄용 문서 표: 1px 헤어라인 격자, 머리글·라벨 셀은 surface-alt 바탕 + 600 text-sub.
// Tr 은 "라벨 | 값" 2칸 행(요약 표 전용), Th/Td 는 다열 표용. 순수 프리젠테이션 — "use client" 없음.

import type { ReactNode } from "react";

type Align = "right" | "center";

export function Tr({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        className="py-1.5 px-3 font-semibold text-text-sub whitespace-nowrap"
        style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-alt)", width: "30%" }}
      >
        {label}
      </td>
      <td className="py-1.5 px-3 text-text-main" style={{ border: "1px solid var(--color-border)" }}>
        {value}
      </td>
    </tr>
  );
}

export function Th({ children, align }: { children: ReactNode; align?: Align }) {
  return (
    <th
      className="py-1.5 px-2.5 font-semibold text-text-sub"
      style={{
        border: "1px solid var(--color-border)",
        background: "var(--color-surface-alt)",
        textAlign: align ?? "left",
      }}
    >
      {children}
    </th>
  );
}

export function Td({ children, align, nowrap }: { children: ReactNode; align?: Align; nowrap?: boolean }) {
  return (
    <td
      className={`py-1.5 px-2.5 text-text-main${nowrap ? " whitespace-nowrap" : ""}`}
      style={{ border: "1px solid var(--color-border)", textAlign: align ?? "left" }}
    >
      {children}
    </td>
  );
}
