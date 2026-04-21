import type { NextConfig } from "next";

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
];

const nextConfig: NextConfig = {
  turbopack: {
    root: "C:\\Users\\acer\\city",
  },
  allowedDevOrigins: ["192.168.0.2", "localhost"],
  // 기술 스택 정보 노출 차단 — X-Powered-By: Next.js 헤더 제거
  poweredByHeader: false,
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

export default nextConfig;
