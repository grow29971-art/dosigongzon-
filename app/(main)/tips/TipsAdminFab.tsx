"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";

// 관리자에게만 보이는 우하단 작성 FAB.
// 비관리자/비로그인은 아무것도 렌더 안 함 (CSS flicker 방지를 위해 확인 전엔 null).
export default function TipsAdminFab() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isCurrentUserAdmin()
      .then((ok) => {
        if (!cancelled) setShow(ok);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <Link
      href="/admin/tips"
      aria-label="꿀팁 작성"
      className="fixed z-40 flex items-center gap-1.5 px-4 py-3 rounded-full bg-primary text-white text-[13px] font-extrabold active:scale-95 transition-transform"
      style={{
        right: 16,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        boxShadow: "0 8px 24px rgba(49,130,246,0.45), 0 2px 6px rgba(0,0,0,0.1)",
      }}
    >
      <Plus size={18} strokeWidth={3} />
      글쓰기
    </Link>
  );
}
