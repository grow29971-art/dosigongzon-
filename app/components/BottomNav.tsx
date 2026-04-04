"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Stethoscope, BookOpen, User } from "lucide-react";

const tabs = [
  { href: "/", label: "홈", Icon: Home },
  { href: "/community", label: "커뮤니티", Icon: Users },
  { href: "/hospitals", label: "병원", Icon: Stethoscope },
  { href: "/protection", label: "보호지침", Icon: BookOpen },
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
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                on ? "text-primary" : "text-text-muted"
              }`}
            >
              <Icon size={22} strokeWidth={on ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
