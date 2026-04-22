import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "길고양이 약품 가이드 — 영양제·구충제·상처 관리";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function PharmacyGuideOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="💊 약품"
        badgeColor="#9B6DD7"
        title="길고양이 약품 가이드"
        highlightText="약품"
        highlightColor="#9B6DD7"
        subtitle="동물약국 영양제·구충제·상처 관리용 약품 정리. 공공 자료 기반, 광고 아닙니다."
        tags={["💊 영양제", "🪱 구충제", "🩹 상처", "🏪 동물약국"]}
      />
    ),
    { ...size },
  );
}
