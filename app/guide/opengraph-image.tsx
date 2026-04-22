import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "도시공존 기능 가이드 — 10가지 핵심 기능을 한눈에";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function GuideOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="✨ 가이드"
        badgeColor="#E8B040"
        title="이 앱으로 뭘 할 수 있어?"
        highlightText="뭘 할 수 있어?"
        highlightColor="#E8B040"
        subtitle="지도·돌봄 일지·커뮤니티·레벨·AI 집사까지. 15가지 기능을 카드 하나씩 시작해보세요."
        tags={["🗺️ 지도", "🐾 돌봄", "💬 커뮤니티", "🏆 레벨"]}
      />
    ),
    { ...size },
  );
}
