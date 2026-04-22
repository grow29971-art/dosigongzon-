import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "길고양이 먹이 가이드 — 안전한 급식 완벽 정리";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function FeedingGuideOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="🍚 보호지침"
        badgeColor="#E88D5A"
        title="길고양이 먹이 가이드"
        highlightText="먹이"
        highlightColor="#E88D5A"
        subtitle="주면 안 되는 음식 10가지 · 안전한 사료 · 급식소 5원칙 · 계절별 주의사항."
        tags={["🚫 금지 음식", "🥣 안전 사료", "📍 급식소", "💧 물"]}
      />
    ),
    { ...size },
  );
}
