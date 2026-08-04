"use client";

// Meta Pixel base code + SPA 라우트 변경 시 PageView 자동 발사.
// ConsentManager가 동의 시에만 마운트. 동의 거부 환경에선 절대 로드 안 됨.

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

// 결제 결과 화면은 URL 쿼리에 결제 식별자가 실려 들어온다. 픽셀은 문서 URL을 통째로
// 전송하므로, 이 경로에서는 스크립트를 아예 로드하지 않고 PageView도 발사하지 않는다.
function isPaymentPath(pathname: string | null): boolean {
  return !!pathname && pathname.startsWith("/shop/payment");
}

function PixelPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.fbq) return;
    if (isPaymentPath(pathname)) return;
    try {
      window.fbq("track", "PageView");
    } catch {
      // ignore
    }
  }, [pathname, searchParams]);

  return null;
}

export default function MetaPixel() {
  const pathname = usePathname();
  if (!META_PIXEL_ID) return null;
  if (isPaymentPath(pathname)) return null;
  // iOS 앱(PWAShell) 에서는 Meta Pixel 비활성 — ATT 미구현으로 Apple 가이드라인 5.1.2 위반 방지
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("PWAShell")) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
        `}
      </Script>
      {/* noscript 환경 fallback (SEO 봇 등) */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
      <Suspense fallback={null}>
        <PixelPageView />
      </Suspense>
    </>
  );
}
