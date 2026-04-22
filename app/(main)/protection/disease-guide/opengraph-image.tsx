import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "길고양이 질병 가이드 — 증상·대응·예방";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function DiseaseGuideOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="🏥 보호지침"
        badgeColor="#D85555"
        title="길고양이 질병 — 10가지"
        highlightText="질병"
        highlightColor="#D85555"
        subtitle="허피스·범백·FIP·구내염·피부병 등 흔한 질병의 증상·대응·예방을 한 페이지에."
        tags={["🤧 감기", "☠️ 범백", "🦷 구내염", "🍄 피부병"]}
      />
    ),
    { ...size },
  );
}
