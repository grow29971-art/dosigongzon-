"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Map, Bell, BookOpen, User } from "lucide-react";
import { getUnreadNotificationCount } from "@/lib/notifications-repo";

const tabs = [
  { href: "/", label: "홈", Icon: Home },
  { href: "/community", label: "커뮤니티", Icon: Users },
  { href: "/map", label: "지도", Icon: Map },
  { href: "/notifications", label: "알림", Icon: Bell },
  { href: "/protection", label: "보호지침", Icon: BookOpen },
  { href: "/mypage", label: "마이", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadNotificationCount().then(setUnreadCount).catch(() => {});
    // 30초마다 갱신
    const interval = setInterval(() => {
      getUnreadNotificationCount().then(setUnreadCount).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white nav-shadow">
      <div className="mx-auto max-w-lg flex justify-around px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ href, label, Icon }) => {
          const on = isActive(href);
          const showBadge = href === "/notifications" && unreadCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                on ? "text-primary" : "text-text-muted"
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={on ? 2.5 : 1.8} />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
                    style={{ backgroundColor: "#D85555" }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
