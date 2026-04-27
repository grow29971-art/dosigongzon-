"use client";

// 로그인 유저가 환영/사용법 안내를 한 번도 안 봤으면 /welcome으로 우회.
// localStorage `dosigongzon_welcome_seen` 키로 디바이스당 1회 노출 보장.
// 신규 가입자는 callback에서 직접 /welcome으로 가므로 게이트가 잡든 말든 결과는 같음.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function WelcomeGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    // /welcome 페이지 자신 위에서는 동작 안 함 (재진입 루프 차단)
    if (pathname?.startsWith("/welcome")) return;
    try {
      if (localStorage.getItem("dosigongzon_welcome_seen")) return;
    } catch {
      return;
    }
    const current = pathname + (typeof window !== "undefined" ? window.location.search : "");
    router.replace(`/welcome?next=${encodeURIComponent(current)}`);
  }, [user, loading, pathname, router]);

  return null;
}
