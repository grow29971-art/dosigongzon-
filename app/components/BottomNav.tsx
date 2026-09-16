"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Map, Bot, MessagesSquare, ShoppingBag, User,
  type LucideIcon,
} from "lucide-react";

// 모던 미니멀 리디자인 (2026-07-10): 스티커 아이콘 → lucide 모노크롬.
// 이전 스티커 아이콘 세트는 app/components/nav-icons.tsx에 보존.
// 인스타 스타일 리디자인 (2026-07-26): 플로팅 라운드 필 + 블러.
// 라벨 복원 (2026-07-27 사장님 요청): 아이콘 아래 텍스트 라벨 표시.
// 활성 탭은 채워진 아이콘 + 강조색.
// 쇼핑 미오픈 상태는 라벨 괄호 대신 아이콘 점 배지로 표시 (2026-08-13 UIUX 오딧:
// 탭 라벨에 시스템 상태를 넣지 않는다 — 진입 후 안내가 담당).

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
  { href: "/shop", label: "쇼핑", Icon: ShoppingBag, wip: true },
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

// D 아이보리 에디토리얼 리디자인 (2026-08-26 사장님 시안 확정):
// 플로팅 라운드 필 → 화면 전폭 도킹 바 + 상단 헤어라인.
// 활성 탭 = 잉크색 굵은 아이콘 + 라벨 아래 테라코타 점. 비활성 = 웜 페일 톤.
const ACTIVE = "var(--color-text-main)";
const INACTIVE = "var(--color-text-light)";

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
      className="fixed left-0 right-0 bottom-0 z-50"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(250,246,240,0.94)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-stretch px-2 pt-2 pb-1.5 mx-auto" style={{ minHeight: 60, maxWidth: "30rem" }}>
        {tabs.map(({ href, label, Icon, wip }) => {
          const on = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={wip ? `${label} (준비 중)` : label}
              aria-current={on ? "page" : undefined}
              className="relative flex flex-1 min-w-0 flex-col items-center justify-start gap-1 px-0.5 press-strong transition-transform"
            >
              <span className="relative">
                <Icon
                  size={21}
                  color={on ? ACTIVE : INACTIVE}
                  strokeWidth={on ? 2.2 : 1.7}
                  style={{ transition: "transform 0.15s", transform: on ? "scale(1.04)" : "none" }}
                />
                {wip && (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--color-warning)" }}
                  />
                )}
              </span>
              <span
                className="w-full text-center whitespace-nowrap"
                style={{
                  fontSize: "10px",
                  lineHeight: 1.1,
                  letterSpacing: "-0.2px",
                  color: on ? ACTIVE : INACTIVE,
                  fontWeight: on ? 700 : 500,
                }}
              >
                {label}
              </span>
              <span
                aria-hidden
                className="rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  background: on ? "var(--color-primary)" : "transparent",
                }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
