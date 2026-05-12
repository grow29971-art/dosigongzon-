import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/app/components/Toast";
import PushSubscriber from "@/app/components/PushSubscriber";
import PwaInstallPrompt from "@/app/components/PwaInstallPrompt";
import PendingInviteApplier from "@/app/components/PendingInviteApplier";
import MarketingConsentApplier from "@/app/components/MarketingConsentApplier";
import SignupNudgeBar from "@/app/components/SignupNudgeBar";
import ConsentManager from "@/app/components/ConsentManager";
import "./globals.css";

const SITE_URL = "https://dosigongzon.com";
const SITE_NAME = "도시공존";
const SITE_TITLE = "도시공존 — 길고양이 돌봄 시민 참여 플랫폼";
const SITE_DESCRIPTION =
  "우리 동네 길고양이 지도 · 돌봄 일지 · TNR·중성화 정보 · 병원/약국 안내를 한 곳에서. 이웃과 함께 만드는 따뜻한 돌봄 커뮤니티, 도시공존.";
const SITE_KEYWORDS = [
  "길고양이", "길냥이", "캣맘", "캣대디", "TNR", "중성화",
  "동물보호", "길고양이 돌봄", "도시공존", "구조동물", "임시보호",
  "고양이 입양", "길고양이 지도", "냥이 지도", "동네 고양이",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | 도시공존",
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: "도시공존" }],
  creator: "도시공존",
  publisher: "도시공존",
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "도시공존 — 길고양이 돌봄 시민 참여 플랫폼",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  category: "community",
  verification: {
    google: "bBcue9CIj5JLafNxn_u41zPHPsKPxnDcFJXoHnVScj4",
    other: {
      "naver-site-verification": "58daf8950fc151db07a0b92aded034390411475c",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F5F3EE",
};

// JSON-LD: Organization 구조화 데이터
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  alternateName: ["도시공존", "DosiGongzon", "도시 공존"],
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  image: `${SITE_URL}/icons/icon-512.png`,
  description: SITE_DESCRIPTION,
  email: "grow29971@gmail.com",
  brand: {
    "@type": "Brand",
    name: "도시공존",
  },
  sameAs: [] as string[],
  areaServed: {
    "@type": "Country",
    name: "대한민국",
  },
  knowsLanguage: ["ko", "ko-KR"],
  knowsAbout: [
    "길고양이 돌봄",
    "TNR",
    "동물보호법",
    "구조동물",
    "임시보호",
    "중성화",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "grow29971@gmail.com",
    contactType: "customer support",
    availableLanguage: ["Korean", "ko"],
  },
};

const jsonLdWebsite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  alternateName: "도시공존",
  url: SITE_URL,
  inLanguage: "ko-KR",
  description: SITE_DESCRIPTION,
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
  },
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/community?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* RSS 자동 발견 — Feedly·NetNewsWire 같은 reader가 사이트 URL만으로 피드 인식 */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="도시공존 — 전체 콘텐츠"
          href="/feed.xml"
        />
        {/* 외부 의존성 preconnect — DNS·TLS 핸드셰이크 미리 끝내 첫 요청 단축 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://sozxbnvgsougkliibnxl.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://sozxbnvgsougkliibnxl.supabase.co" />
        <link rel="dns-prefetch" href="https://dapi.kakao.com" />
        {/* Pretendard CSS — render-blocking 방지: preload 시작 + media=print로 비동기 적용.
            font-display: swap이 이미 적용돼 시스템 폰트로 즉시 렌더 → 폰트 로드 후 swap.
            인라인 스크립트가 로드 직후 media=all로 전환. JS 꺼진 브라우저는 noscript 폴백. */}
        <link
          rel="preload"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
        <link
          id="pretendard-css"
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
          media="print"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: "var l=document.getElementById('pretendard-css');if(l){l.onload=function(){this.media='all'};if(l.sheet)l.media='all'}",
          }}
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
            crossOrigin="anonymous"
          />
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite).replace(/</g, "\\u003c") }}
        />
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>
            {children}
            <PushSubscriber />
            <PwaInstallPrompt />
            <PendingInviteApplier />
            <MarketingConsentApplier />
            <SignupNudgeBar />
          </ToastProvider>
        </AuthProvider>
        {/* 쿠키 동의 배너 + 동의 시에만 Vercel Analytics·SpeedInsights 로드 */}
        <ConsentManager />
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js");if(localStorage.getItem("dosigongzon_dark")==="1")document.documentElement.classList.add("dark")`,
          }}
        />
      </body>
    </html>
  );
}
