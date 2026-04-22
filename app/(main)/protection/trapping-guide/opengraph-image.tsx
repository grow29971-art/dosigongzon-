import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "길고양이 포획 가이드 — 준비물·설치·대기·주의사항";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function TrappingGuideOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="🪤 TNR 지원"
        badgeColor="#8B65B8"
        title="길고양이 포획 가이드"
        highlightText="포획"
        highlightColor="#8B65B8"
        subtitle="TNR을 위한 포획 도구 선택, 미끼 놓기, 안전 대기, 스트레스 최소화 원칙까지."
        tags={["🪤 포획틀", "🍗 미끼", "⏱️ 대기", "✂️ TNR"]}
      />
    ),
    { ...size },
  );
}
