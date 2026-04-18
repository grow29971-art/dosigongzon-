import type { MetadataRoute } from "next";

const SITE_URL = "https://dosigongzon.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/mypage/",
          "/messages/",
          "/notifications/",
          "/onboarding/",
          "/find-account/",
          // 로그인 가드 걸린 경로 — 크롤러가 접근해도 로그인 화면만 보임
          "/community",
          "/community/",
          "/neighborhood",
          "/neighborhood/",
        ],
      },
      // 네이버 검색 봇
      {
        userAgent: "Yeti",
        allow: "/",
        disallow: [
          "/api/", "/admin/", "/mypage/", "/messages/",
          "/community", "/community/", "/neighborhood", "/neighborhood/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
