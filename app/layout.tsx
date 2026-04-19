import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/lib/auth-context";
import PushSubscriber from "@/app/components/PushSubscriber";
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
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
  category: "community",
  verification: {
    google: "GYsqQQsXSHohScWs04azTgn87IS7JS0SY07hirxXp-8",
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
  alternateName: "DosiGongzon",
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  description: SITE_DESCRIPTION,
  sameAs: [] as string[],
  areaServed: {
    "@type": "Country",
    name: "대한민국",
  },
  knowsAbout: [
    "길고양이 돌봄",
    "TNR",
    "동물보호법",
    "구조동물",
    "임시보호",
    "중성화",
  ],
};

const jsonLdWebsite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: "ko-KR",
  description: SITE_DESCRIPTION,
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
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
        />
      </head>
      <body>
        <AuthProvider>
          {children}
          <PushSubscriber />
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js");if(localStorage.getItem("dosigongzon_dark")==="1")document.documentElement.classList.add("dark")`,
          }}
        />
      </body>
    </html>
  );
}
