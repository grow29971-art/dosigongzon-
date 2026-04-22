import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "길고양이 쉼터 · 겨울나기 가이드 — 숨숨집 DIY와 계절 운영";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function ShelterGuideOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="🏠 보호지침"
        badgeColor="#4A7BA8"
        title="길고양이 쉼터"
        highlightText="쉼터"
        highlightColor="#4A7BA8"
        subtitle="숨숨집 DIY · 설치 원칙 · 여름·겨울 계절 운영까지. 안전하고 따뜻한 집을 만들어요."
        tags={["📦 숨숨집", "❄️ 겨울", "☀️ 여름", "📍 설치"]}
      />
    ),
    { ...size },
  );
}
