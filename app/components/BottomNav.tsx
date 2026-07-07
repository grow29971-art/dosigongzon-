"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NavHomeIcon, NavMapIcon, NavGuideIcon, NavAiButlerIcon,
  NavCommunityIcon, NavCardGameIcon, NavMyIcon,
} from "@/app/components/nav-icons";

const tabs = [
  { href: "/", label: "홈", Icon: NavHomeIcon },
  { href: "/map", label: "지도", Icon: NavMapIcon },
  { href: "/tips", label: "가이드", Icon: NavGuideIcon },
  { href: "/lab/cat-style", label: "AI집사", Icon: NavAiButlerIcon },
  { href: "/community", label: "커뮤니티", Icon: NavCommunityIcon },
  { href: "/mypage/cards", label: "카드게임", Icon: NavCardGameIcon },
  { href: "/mypage", label: "마이", Icon: NavMyIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "linear-gradient(180deg, #4C82BC 0%, #3E6FA8 100%)",
        boxShadow: "0 -4px 16px rgba(20,40,70,0.25)",
      }}
    >
      <div className="mx-auto max-w-lg flex justify-around px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ href, label, Icon }) => {
          const on = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={on ? "page" : undefined}
              className="relative flex flex-col items-center gap-0.5 px-2 py-1"
            >
              <span
                className="flex items-center justify-center rounded-2xl transition-all"
                style={{
                  width: 44, height: 44,
                  background: on ? "rgba(255,255,255,0.22)" : "transparent",
                  transform: on ? "scale(1.06)" : "scale(1)",
                  opacity: on ? 1 : 0.82,
                }}
              >
                <Icon size={28} />
              </span>
              <span
                className="text-[10px] font-extrabold"
                style={{
                  color: "#fff",
                  opacity: on ? 1 : 0.75,
                  textShadow: "0 1px 2px rgba(20,40,70,0.5)",
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
