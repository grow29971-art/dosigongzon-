import Link from "next/link";
import type { Metadata } from "next";
import { PawPrint } from "lucide-react";

export const metadata: Metadata = {
  title: "길을 잃었어요 (404)",
  description: "찾으시는 페이지가 없거나 이동됐어요. 도시공존 홈으로 돌아가주세요.",
  robots: { index: false, follow: false },
};

const LINKS = [
  { href: "/map", label: "지도" },
  { href: "/protection", label: "보호지침" },
  { href: "/community", label: "커뮤니티" },
  { href: "/guide", label: "기능 가이드" },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-surface">
      <div className="w-full max-w-md text-center">
        <PawPrint size={44} strokeWidth={1.6} className="mx-auto mb-4" style={{ color: "var(--color-text-light)" }} aria-hidden />
        <p className="text-[13px] font-semibold tracking-[0.2em] mb-3 text-text-light">404</p>
        <h1 className="text-[24px] font-bold text-text-main tracking-tight leading-tight mb-2">
          아이를 찾지 못했어요
        </h1>
        <p className="text-[13px] text-text-sub leading-relaxed mb-7">
          주소가 바뀌었거나 삭제된 페이지예요.
        </p>

        {/* 주요 이동 버튼 */}
        <div className="flex flex-col gap-2.5">
          <Link
            href="/"
            className="w-full h-12 flex items-center justify-center text-[15px] font-semibold press transition-transform"
            style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
          >
            홈으로 가기
          </Link>
          <div className="grid grid-cols-2 gap-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="h-10 flex items-center justify-center text-[13px] font-semibold press"
                style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)", borderRadius: "var(--radius-input)" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-text-light mt-6 leading-relaxed">
          동네의 아이들이 기다리고 있어요
        </p>
      </div>
    </div>
  );
}
