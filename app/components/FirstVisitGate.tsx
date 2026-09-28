"use client";

// 홈이 아닌 페이지로 처음 들어온 비로그인 방문자에게도 첫 방문 화면(HelloScreen)을 덮는다.
// 홈(/)은 서버에서 이미 덮으므로(app/(main)/page.tsx) 여기선 건너뛴다. 레이아웃 전체를 동적 렌더로
// 만들지 않으려고 클라이언트에서만 판단한다 — 그래서 첫 페인트 뒤 잠깐 늦게 뜬다.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import HelloScreen from "@/app/components/HelloScreen";
import { isMiniApp } from "@/lib/miniapp";

// 가입·로그인 흐름, 결제 리다이렉트, 법적 고지, 관리·내부 화면엔 띄우지 않는다.
const SKIP = ["/login", "/signup", "/welcome", "/onboarding", "/hello", "/auth", "/admin", "/terms", "/privacy",
  "/account-deletion", "/shop/checkout", "/shop/payment", "/shop/orders", "/darkcheck", "/z/"];

export default function FirstVisitGate() {
  const pathname = usePathname() ?? "/";
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pathname === "/" || SKIP.some((p) => pathname.startsWith(p)) || isMiniApp()) return;
    const c = document.cookie;
    if (c.includes("hello_seen=") || /sb-[^=]*-auth-token/.test(c)) return;
    if (/bot|crawl|spider|slurp|yeti|daum|facebookexternalhit|kakaotalk-scrap/i.test(navigator.userAgent)) return;
    setShow(true);
  }, [pathname]);

  return show ? <HelloScreen overlay onDismiss={() => setShow(false)} /> : null;
}
