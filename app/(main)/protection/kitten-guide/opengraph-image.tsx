import { ImageResponse } from "next/og";
import { GuideOGTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "새끼 고양이 냥줍 가이드 — 관찰·보온·KMR·병원";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function KittenGuideOG() {
  return new ImageResponse(
    (
      <GuideOGTemplate
        badge="🍼 보호지침"
        badgeColor="#E8B040"
        title="새끼 고양이 냥줍"
        highlightText="냥줍"
        highlightColor="#E8B040"
        subtitle="어미 기다리기부터 KMR 분유·체온 관리·병원 방문까지 단계별 완벽 매뉴얼."
        tags={["👀 관찰", "🌡️ 보온", "🍼 KMR", "🏥 병원"]}
      />
    ),
    { ...size },
  );
}
