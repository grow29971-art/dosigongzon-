"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Map, BookOpen, User, Bot, Layers } from "lucide-react";

const tabs = [
  { href: "/", label: "홈", Icon: Home },
  { href: "/map", label: "지도", Icon: Map },
  { href: "/tips", label: "가이드", Icon: BookOpen },
  { href: "/lab/cat-style", label: "AI집사", Icon: Bot },
  { href: "/community", label: "커뮤니티", Icon: Users },
  { href: "/mypage/cards", label: "카드", Icon: Layers },
  { href: "/mypage", label: "마이", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", boxShadow: "0 -4px 16px rgba(60,50,90,0.06)" }}>
      <div className="mx-auto max-w-lg flex justify-around px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ href, label, Icon }) => {
          const on = isActive(href);
          const isCard = href === "/mypage/cards";
          const dotColor = isCard ? "#8B6FE0" : "#5C93F0";
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={on ? "page" : undefined}
              className="relative flex flex-col items-center gap-0.5 px-2 py-1"
            >
              <span
                className="flex items-center justify-center rounded-full transition-colors"
                style={{
                  width: 34, height: 34,
                  background: on ? dotColor : "transparent",
                  color: on ? "#fff" : "#B4AFC2",
                }}
              >
                <Icon size={19} strokeWidth={on ? 2.5 : 1.8} />
              </span>
              <span className="text-[10px] font-semibold" style={{ color: on ? dotColor : "#B4AFC2" }}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
