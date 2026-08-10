import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// ══════════════════════════════════════════
// 보안 헤더
// ══════════════════════════════════════════
// CSP 정책 — 이 프로젝트의 실제 외부 의존성만 allowlist로 허용.
// - Kakao Maps SDK + 타일: dapi.kakao.com, *.daumcdn.net
// - Supabase Storage/Realtime/Auth: *.supabase.co (+ wss)
// - 이미지: placehold.co, 모든 https (사용자 업로드 이미지 호스트가 다양할 수 있음)
// 인라인 스타일/스크립트: React/Next 런타임이 필요로 해서 'unsafe-inline' 유지.
// nonce 기반 strict CSP는 동적 렌더링 강제 등 트레이드오프가 커 현재 단계에서는 보류.
//
// 'unsafe-eval' 제거 (2026-07-26 보안 강화): 앱·lib 소스에 eval/new Function/WebAssembly
// 사용이 전무해 프로덕션에선 불필요. 단 Next dev(Turbopack HMR)는 eval을 쓰므로 개발에서만 허용.
// ⚠ 배포 전 확인: 프로덕션/프리뷰에서 지도(Kakao)·결제(Toss) 플로우가 정상 동작하는지 —
//   해당 SDK가 eval을 요구하면 콘솔에 CSP 위반이 뜬다(그 경우에만 해당 호스트 script-src 확인).
const IS_DEV = process.env.NODE_ENV !== "production";
const scriptEval = IS_DEV ? " 'unsafe-eval'" : "";

// 우리 Supabase 프로젝트 호스트만 이미지 최적화 대상으로 허용하기 위한 값.
// 환경변수가 없으면 어떤 원격 이미지도 매칭되지 않는 값으로 두어 fail-closed.
const SUPABASE_HOSTNAME = (() => {
  try {
    // .env 값에 개행이 섞여 들어온 전례가 있어 trim 후 파싱한다.
    return new URL((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()).hostname || "unset.invalid";
  } catch {
    return "unset.invalid";
  }
})();
const cspDirectives = [
  "default-src 'self'",
  // connect.facebook.net: Meta Pixel(fbevents.js) — ConsentManager 동의 시에만 마운트되지만
  // CSP에 없으면 동의한 유저조차 스크립트 로드가 차단돼 광고 측정이 통째로 죽는다.
  `script-src 'self' 'unsafe-inline'${scriptEval} https://dapi.kakao.com https://*.daumcdn.net https://challenges.cloudflare.com https://js.tosspayments.com https://connect.facebook.net`,
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://dapi.kakao.com https://*.daumcdn.net https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.tosspayments.com https://connect.facebook.net https://www.facebook.com",
  // postcode.map.kakao.com(신규)/postcode.map.daum.net(구): 주문서의 우편번호 검색 iframe
  // *.tosspayments.com / pay.toss.im: 토스페이먼츠 결제위젯·결제창
  "frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://postcode.map.kakao.com https://postcode.map.daum.net https://*.tosspayments.com https://pay.toss.im",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives,
  },
  // clickjacking — iframe 내 렌더 금지 (CSP frame-ancestors로도 중복 방어)
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // MIME sniffing 차단
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // 레퍼러 누출 최소화 — 외부 링크로 유저 경로 유출 방지
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // 사용하지 않는 브라우저 권한 차단
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  // HTTPS 강제 (프로덕션에서 의미 있음; 로컬 http 개발엔 무해)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // 레거시 XSS 필터는 비활성(0)이 현대 권장 — CSP가 대체. 활성(1) 필터는
  // 오히려 공격 벡터가 되는 사례가 있어 OWASP도 0을 권고.
  {
    key: "X-XSS-Protection",
    value: "0",
  },
  // cross-origin 리소스 도용 차단 (Spectre/사이드채널 방어)
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  // 다른 오리진 팝업과의 상호작용 제한 (타이밍 공격 차단)
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
];

const nextConfig: NextConfig = {
  // turbopack.root는 모노레포에서만 필요. 단일 프로젝트는 자동 감지.
  allowedDevOrigins: ["192.168.0.2", "localhost"],
  // 기술 스택 정보 노출 차단 — X-Powered-By: Next.js 헤더 제거
  poweredByHeader: false,
  // 패키지 import 최적화 — 명시 named import만 번들 (lucide-react 150+개 아이콘 중 사용분만).
  // Next 16 기본 리스트는 ["geist"] 뿐. lucide는 별도 추가 필요.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // jsdom 기반 DOMPurify(tips 렌더 sink 정화)는 서버 외부 패키지로 두어 번들 문제 회피
  serverExternalPackages: ["isomorphic-dompurify"],
  // next/image — Vercel Image Optimization 활성. 자동 WebP/AVIF + 디바이스별 리사이즈.
  // 서드파티 아바타(Google/Kakao)는 이미 CDN 최적화 상태라 개별 컴포넌트에서 unoptimized 유지.
  // quota 한계: Hobby 1000 source images/month (현재 사용 << 한계).
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30일 — Storage 사진 거의 안 바뀜
    // 리다이렉트는 remotePatterns 재검증을 받지 않는다 — 허용 호스트에 리다이렉트만
    // 두면 임의 호스트를 대신 fetch하게 되므로 추종을 끈다. (2026-08-04 보안)
    maximumRedirects: 0,
    remotePatterns: [
      // supabase.co는 멀티테넌트 호스트다. 와일드카드를 두면 누구나 자기 프로젝트에
      // 파일을 올려 우리 이미지 최적화기를 통과시킬 수 있어 우리 프로젝트로 고정한다.
      // 핵심 방어는 호스트 고정이다. 경로는 public/sign 둘 다 허용 —
      // 서명 URL은 토큰이 있어야 열리므로 최적화기를 거쳐도 권한 우회가 아니고,
      // public만 허용하면 나중에 서명 URL을 <Image>로 바꾼 화면이 조용히 깨진다.
      {
        protocol: "https",
        hostname: SUPABASE_HOSTNAME,
        pathname: "/storage/v1/object/**",
      },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "k.kakaocdn.net", pathname: "/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // API CORS: 자체 도메인만 허용
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://dosigongzon.com" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      // PWA 자원 — 외부 도구(PWABuilder, Lighthouse, Play Store) 접근 허용
      {
        source: "/manifest.json",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/.well-known/:path*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

// Sentry 통합 — source map 업로드 + 클라이언트 번들 자동 instrument.
// SENTRY_AUTH_TOKEN이 있을 때만 source map 업로드 (없으면 런타임 추적은 됨, 심볼 없는 stacktrace).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // 무료 플랜 대응: 로그 최소
  silent: !process.env.CI,
  // 클라이언트 번들 크기 최적화
  widenClientFileUpload: true,
  // Ad blocker·privacy 툴 우회를 위해 자체 도메인에 /monitoring 터널 설정
  tunnelRoute: "/monitoring",
  // Vercel Cron 등 서버 전용 실행에서 불필요한 경고 제거
  disableLogger: true,
  // React 컴포넌트 소스맵 활성화
  reactComponentAnnotation: { enabled: true },
});
