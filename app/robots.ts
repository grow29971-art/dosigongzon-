import type { MetadataRoute } from "next";

const SITE_URL = "https://dosigongzon.com";

// 크롤러가 접근해도 의미 없거나(로그인 가드) 민감하거나(개인 정보) 긴급(실시간)인 경로.
const DISALLOWED_PATHS = [
  "/api/",
  "/admin/",
  "/mypage/",
  "/messages/",
  "/notifications/",
  "/onboarding/",
  "/find-account/",
  // 개인 프로필 — metadata에 noindex 있지만 봇 낭비 방지
  "/users/",
  // 긴급 구조 피드 — 실시간·민감 정보라 검색 노출 안 함
  "/rescue",
  "/rescue/",
  // 로그인 가드 걸린 경로 — 크롤러가 접근해도 로그인 화면만 보임
  "/community",
  "/community/",
  "/neighborhood",
  "/neighborhood/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
      // 네이버 검색 봇 (Yeti)
      {
        userAgent: "Yeti",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
