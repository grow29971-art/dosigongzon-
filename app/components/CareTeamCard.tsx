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
        className="rounded-2xl bg-white p-4"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(107,142,111,0.12)", color: "#4F6B53" }}
          >
            <Users size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="care-team-heading" className="text-[15px] font-extrabold text-text-main">
              돌봄팀
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-text-sub">
              서클·동네 채팅·고양이 커뮤니티를 한 곳에서 오갈 수 있어요.
            </p>
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {careTeamSections().map((section) => {
            const isCurrent = currentKey === section.key;
            const label = (
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-text-main">
                  {section.label}
                </span>
                <span className="block truncate text-[11px] text-text-sub">
                  {section.description}
                </span>
              </span>
            );
            return (
              <li key={section.key}>
                {isCurrent ? (
                  <div
                    className="flex items-center justify-between rounded-xl bg-[#F7F4EE] px-3 py-2.5"
                    aria-current="page"
                  >
                    {label}
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-text-sub">
                      현재 위치
                    </span>
                  </div>
                ) : (
                  <Link
                    href={section.href}
                    className="flex items-center justify-between rounded-xl bg-[#F7F4EE] px-3 py-2.5 active:scale-[0.99]"
                  >
                    {label}
                    <ChevronRight size={16} className="shrink-0 text-text-sub" aria-hidden="true" />
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
