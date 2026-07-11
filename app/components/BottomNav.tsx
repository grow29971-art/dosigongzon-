"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Map, Bot, MessagesSquare, ShoppingBag, User,
  type LucideIcon,
} from "lucide-react";

// 모던 미니멀 리디자인 (2026-07-10): 스티커 아이콘 → lucide 모노크롬.
// 이전 스티커 아이콘 세트는 app/components/nav-icons.tsx에 보존.
const tabs: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "홈", Icon: Home },
  { href: "/map", label: "지도", Icon: Map },
  // 가이드 → AI집사로 라벨/아이콘 변경 (2026-07-11) — 목적지는 그대로 /tips (AI집사 챗봇 위치)
  { href: "/tips", label: "AI집사", Icon: Bot },
  { href: "/community", label: "커뮤니티", Icon: MessagesSquare },
  // 카드게임 탭 숨김 (2026-07-10) — 복원 시 아래 줄 주석 해제
  // { href: "/mypage/cards", label: "카드게임", Icon: Gamepad2 },
  { href: "/shop", label: "쇼핑(공사중)", Icon: ShoppingBag },
  { href: "/mypage", label: "마이", Icon: User },
];

const ACTIVE = "var(--color-primary)";
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
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid var(--color-surface-alt)",
      }}
    >
      <div className="mx-auto max-w-lg flex px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ href, label, Icon }) => {
          const on = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={on ? "page" : undefined}
              className="relative flex flex-1 min-w-0 flex-col items-center gap-1 px-0.5 py-1.5 active:scale-95 transition-transform"
            >
              <Icon
                size={22}
                color={on ? ACTIVE : INACTIVE}
                strokeWidth={on ? 2.4 : 1.8}
              />
              <span
                className="text-[10px] w-full text-center truncate"
                style={{
                  color: on ? ACTIVE : INACTIVE,
                  fontWeight: on ? 800 : 600,
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
