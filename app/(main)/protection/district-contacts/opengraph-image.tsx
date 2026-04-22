import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "구청 동물보호 담당부서 연락처 — 시·군·구별 정리";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function DistrictContactsOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="📞 연락처"
        badgeColor="#48A59E"
        title="구청 동물보호 연락처"
        highlightText="연락처"
        highlightColor="#48A59E"
        subtitle="서울 25개 자치구 + 전국 주요 시·군 동물보호 담당부서. 민원·TNR 신청 전화 한 번에."
        tags={["🏢 25개 구", "📱 전화", "✉️ 민원", "📋 TNR 신청"]}
      />
    ),
    { ...size },
  );
}
