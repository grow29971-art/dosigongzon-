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
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://dapi.kakao.com https://*.daumcdn.net https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://dapi.kakao.com https://*.daumcdn.net https://cdn.jsdelivr.net https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
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
  turbopack: {
    root: "C:\\Users\\acer\\city",
  },
  allowedDevOrigins: ["192.168.0.2", "localhost"],
  // 기술 스택 정보 노출 차단 — X-Powered-By: Next.js 헤더 제거
  poweredByHeader: false,
  // next/image 설정 — Vercel Image Optimization quota 이슈로 unoptimized 모드.
  // lazy loading·sizes 등 next/image 기본 기능은 유지, 자동 WebP 변환만 비활성.
  // quota 확보 후 unoptimized: false + remotePatterns로 전환 검토.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "k.kakaocdn.net" },
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
