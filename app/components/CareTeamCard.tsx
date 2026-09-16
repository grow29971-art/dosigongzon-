"use client";

// ══════════════════════════════════════════
// P4 돌봄팀 통합 — 공용 진입 카드 컴포넌트
// 설계: box/개발일지_20260726_핵심여정개편.md P4
//
// 목적: 서클·동네 채팅·고양이 커뮤니티를 한 곳에서 오가는 "돌봄팀" 진입
//   카드의 JSX를 한 곳으로 모은다. 여러 섹션(서클/지도/커뮤니티)에서 같은
//   카드를 중복 없이 재사용하기 위한 추출이며 동작 변경은 없다.
//
// 불변식(변경 금지):
//  - 순수 계약 재사용: 섹션 순서·URL은 lib/care-team.ts의 계약만 사용한다.
//    새 라우트·데이터·스키마 변경 없음.
//  - 현재 위치 강조: 지금 보고 있는 경로가 하위 섹션이면 링크 대신
//    '현재 위치' 배지 + aria-current="page"로 표시한다(중복 자기링크 제거).
//  - flag 게이팅은 호출부 책임: 이 컴포넌트는 표시 여부를 판단하지 않는다.
//    P4 flag off / kill switch on일 때 호출부가 렌더하지 않는다.
//
// 2026-09-16 「익숙한 동네앱」 리디자인: 틴트 아이콘 박스·회색 면 행 → 흰 면 + 헤어라인 카드,
// 회색 선 아이콘, 구분선 리스트 행. 계약 심볼·링크 동작은 그대로.
// ══════════════════════════════════════════

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";
import { careTeamSections, careTeamSectionByHref } from "@/lib/care-team";

export default function CareTeamCard() {
  const pathname = usePathname();
  const currentKey = careTeamSectionByHref(pathname)?.key;

  return (
    <section className="px-5 mt-5" aria-labelledby="care-team-heading">
      <div
        className="overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <Users size={22} className="shrink-0 mt-0.5" style={{ color: "var(--color-text-sub)" }} strokeWidth={1.8} aria-hidden="true" />
          <div>
            <h2 id="care-team-heading" className="text-[15px] font-semibold text-text-main">
              돌봄팀
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-text-sub">
              서클·동네 채팅·고양이 커뮤니티를 한 곳에서 오갈 수 있어요.
            </p>
          </div>
        </div>
        <ul>
          {careTeamSections().map((section) => {
            const isCurrent = currentKey === section.key;
            const label = (
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-text-main leading-snug">
                  {section.label}
                </span>
                <span className="block truncate text-[13px] text-text-sub mt-0.5">
                  {section.description}
                </span>
              </span>
            );
            return (
              <li key={section.key} style={{ borderTop: "1px solid var(--color-divider)" }}>
                {isCurrent ? (
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-3"
                    style={{ minHeight: 56 }}
                    aria-current="page"
                  >
                    {label}
                    <span
                      className="shrink-0 px-1.5 py-0.5 text-[11px] font-medium text-text-sub"
                      style={{ borderRadius: "var(--radius-square)", border: "1px solid var(--color-border)" }}
                    >
                      현재 위치
                    </span>
                  </div>
                ) : (
                  <Link
                    href={section.href}
                    className="flex items-center justify-between gap-3 px-4 py-3 press"
                    style={{ minHeight: 56 }}
                  >
                    {label}
                    <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} aria-hidden="true" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
