"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Map, Bot, MessagesSquare, ShoppingBag, User,
  type LucideIcon,
} from "lucide-react";

// 모던 미니멀 리디자인 (2026-07-10): 스티커 아이콘 → lucide 모노크롬.
// 이전 스티커 아이콘 세트는 app/components/nav-icons.tsx에 보존.
// 인스타 스타일 리디자인 (2026-07-26): 플로팅 라운드 필 + 블러 + 아이콘 온리,
// 활성 탭은 채워진 아이콘. 텍스트 라벨 제거(접근성은 aria-label로 유지).
// 이전(라벨형 풀폭 바) 복원 시 git에서 이 파일의 직전 버전 revert.

// ── 결제 오픈 D-day 탭 재편 (2026-07-21 쇼핑 동선 회의 선구축) ──
// 통신판매업 신고 완료 → PAYMENT_ENABLED=true 되는 날 이 플래그도 true로:
// 5탭(홈|지도|쇼핑|커뮤니티|마이), 쇼핑 정중앙, 공사중 배지 해제.
// AI집사 탭은 제거되지만 홈 헤더 Bot 아이콘 + 마이페이지 경로가 이미 있음(이중 진입점).
// ⚠ 켜기 전 조건: box/supabase_ai_chat_usage_migration.sql 계측 데이터로 AI집사 사용량 확인.
const SHOP_OPEN_NAV = false;

type Tab = { href: string; label: string; Icon: LucideIcon; wip?: boolean };

const legacyTabs: Tab[] = [
  { href: "/", label: "홈", Icon: Home },
  { href: "/map", label: "지도", Icon: Map },
  // 가이드 → AI집사로 라벨/아이콘 변경 (2026-07-11) — 목적지는 그대로 /tips (AI집사 챗봇 위치)
  { href: "/tips", label: "AI집사", Icon: Bot },
  { href: "/community", label: "커뮤니티", Icon: MessagesSquare },
  // 카드게임 탭 숨김 (2026-07-10) — 복원 시 아래 줄 주석 해제
  // { href: "/mypage/cards", label: "카드게임", Icon: Gamepad2 },
  // 아이콘 온리 전환으로 "(공사중)" 라벨 대신 wip 점 배지로 표시
  { href: "/shop", label: "쇼핑(공사중)", Icon: ShoppingBag, wip: true },
  { href: "/mypage", label: "마이", Icon: User },
];

const shopOpenTabs: Tab[] = [
  { href: "/", label: "홈", Icon: Home },
  { href: "/map", label: "지도", Icon: Map },
  { href: "/shop", label: "쇼핑", Icon: ShoppingBag },
  { href: "/community", label: "커뮤니티", Icon: MessagesSquare },
  { href: "/mypage", label: "마이", Icon: User },
];

const tabs = SHOP_OPEN_NAV ? shopOpenTabs : legacyTabs;

const ACTIVE = "var(--color-primary)";
const INACTIVE = "#4E5968";

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // 쇼핑 하위 플로우(상품 상세/장바구니/주문서/결제)는 하단 고정 결제 바와
  // 겹쳐서 버튼을 가리므로 네비 숨김 — 각 페이지에 뒤로가기 버튼 있음.
  if (/^\/shop\/.+/.test(pathname)) return null;

  return (
    <nav
      aria-label="하단 메뉴"
      className="fixed left-1/2 -translate-x-1/2 z-50"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        width: "min(calc(100% - 24px), 26rem)",
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.65)",
        borderRadius: 9999,
        boxShadow:
          "0 8px 32px rgba(25,31,40,0.14), 0 1px 2px rgba(25,31,40,0.06)",
      }}
    >
      <div className="flex items-center px-2" style={{ height: 58 }}>
        {tabs.map(({ href, label, Icon, wip }) => {
          const on = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={on ? "page" : undefined}
              className="relative flex flex-1 min-w-0 items-center justify-center h-full active:scale-90 transition-transform"
            >
              <Icon
                size={25}
                color={on ? ACTIVE : INACTIVE}
                strokeWidth={on ? 2.3 : 1.7}
                fill={on ? "var(--color-primary-soft)" : "none"}
                style={{ transition: "transform 0.15s", transform: on ? "scale(1.08)" : "none" }}
              />
              {wip && !on && (
                <span
                  aria-hidden
                  className="absolute rounded-full"
                  style={{
                    top: 13,
                    right: "calc(50% - 17px)",
                    width: 7,
                    height: 7,
                    background: "#F5A623",
                    border: "1.5px solid rgba(255,255,255,0.9)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
