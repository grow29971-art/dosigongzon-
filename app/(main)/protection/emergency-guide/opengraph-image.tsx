import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "길고양이 응급 구조 가이드 — 안전확보·지혈·이송";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function EmergencyGuideOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="🚑 응급 대응"
        badgeColor="#D85555"
        title="긴급! 길고양이 구조"
        highlightText="긴급!"
        highlightColor="#D85555"
        subtitle="사고·상처·탈진 발견 시 단계별 조치 · 이송 방법 · 연락처. 지금 바로 쓰는 가이드."
        tags={["🛡️ 안전확보", "🩹 지혈", "🚗 이송", "📞 연락처"]}
      />
    ),
    { ...size },
  );
}
