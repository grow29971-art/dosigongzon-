import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "긴급 구조 피드 — 지금 도움이 필요한 아이들";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function RescueOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="🚨 긴급"
        badgeColor="#D85555"
        title="긴급 구조가 필요해요"
        highlightText="긴급"
        highlightColor="#D85555"
        subtitle="건강 상태가 위험으로 기록된 아이들. 가장 가까운 이웃의 한 번의 방문이 생명을 바꿔요."
        tags={["🚨 LIVE", "🏥 병원", "💧 탈수", "🩹 부상"]}
      />
    ),
    { ...size },
  );
}
