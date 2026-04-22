import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "도시공존 소개 — 길고양이와 함께 걷는 한 걸음";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function AboutOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="🐾 소개"
        badgeColor="#C47E5A"
        title="도시공존 · 시민 참여"
        highlightText="시민 참여"
        highlightColor="#C47E5A"
        subtitle="길고양이를 함께 기록하고 돌보는 오픈 플랫폼. 광고 없이 이웃들이 모여 만드는 따뜻한 지도."
        tags={["🗺️ 돌봄 지도", "✂️ TNR", "🏥 구조", "💛 무료"]}
      />
    ),
    { ...size },
  );
}
