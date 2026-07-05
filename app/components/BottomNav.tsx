"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Map, BookOpen, User, Bot } from "lucide-react";

const tabs = [
  { href: "/", label: "홈", Icon: Home },
  { href: "/map", label: "지도", Icon: Map },
  { href: "/tips", label: "가이드", Icon: BookOpen },
  { href: "/lab/cat-style", label: "AI집사", Icon: Bot },
  { href: "/community", label: "커뮤니티", Icon: Users },
  { href: "/mypage/cards", label: "카드", Icon: null },
  { href: "/mypage", label: "마이", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white nav-shadow">
      <div className="mx-auto max-w-lg flex justify-around px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ href, label, Icon }) => {
          const on = isActive(href);
          const isCard = href === "/mypage/cards";
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={on ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
                isCard
                  ? on ? "text-indigo-500" : "text-indigo-300"
                  : on ? "text-primary" : "text-text-muted"
              }`}
            >
              {isCard ? (
                <span className="text-[22px] leading-none">🃏</span>
              ) : (
                Icon && <Icon size={22} strokeWidth={on ? 2.5 : 1.8} />
              )}
              <span className="text-[10px] font-semibold">{label}</span>
              {isCard && on && (
                <span className="absolute -top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
