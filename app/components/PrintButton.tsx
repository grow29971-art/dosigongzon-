"use client";

import { Printer } from "lucide-react";

// 확인서 페이지의 인쇄/PDF 저장 버튼 — window.print()만 필요해서 분리한 클라이언트 컴포넌트
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold text-white press transition-transform"
      style={{ background: "var(--color-primary)", boxShadow: "var(--shadow-primary)" }}
    >
      <Printer size={14} />
      인쇄 · PDF로 저장
    </button>
  );
}
