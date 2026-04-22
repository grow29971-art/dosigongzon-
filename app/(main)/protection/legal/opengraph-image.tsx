import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "길고양이 법률 가이드 — 동물보호법과 학대 대응";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function LegalGuideOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="⚖️ 법률"
        badgeColor="#2C2C2C"
        title="길고양이와 법"
        highlightText="법"
        highlightColor="#D85555"
        subtitle="동물보호법 제8조 · 학대 신고 절차 · 재물손괴 적용 · 구조 비용 지원까지 한눈에."
        tags={["📜 보호법", "🚨 학대신고", "🛡️ 구조", "📞 112"]}
      />
    ),
    { ...size },
  );
}
