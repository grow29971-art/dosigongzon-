import { ImageResponse } from "next/og";
import { findGuBySlug } from "@/lib/seoul-regions";
import { getCatCountByRegionServer } from "@/lib/cats-server";
import { createAnonClient } from "@/lib/supabase/anon";
import {
  OGBrand,
  OG_BRAND,
  OG_FACE,
  OG_INK,
  OG_INK_LIGHT,
  OG_INK_SUB,
  OG_LINE,
} from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "도시공존 — 우리 동네 길고양이 지도";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 1시간 캐시 — 지역별 OG는 페이지 ISR(3600s)과 동일 주기.
export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

async function getRegionStats(guName: string, dongs: string[]) {
  try {
    const [count, urgentRes] = await Promise.all([
      getCatCountByRegionServer(guName, dongs),
      (async () => {
        const supabase = createAnonClient();
        return supabase
          .from("cats")
          .select("*", { count: "exact", head: true })
          .eq("region", guName)
          .eq("health_status", "danger");
      })(),
    ]);
    return { catCount: count, urgent: urgentRes.count ?? 0 };
  } catch {
    return { catCount: 0, urgent: 0 };
  }
}

export default async function AreaOpengraphImage({ params }: { params: Params }) {
  const { slug } = await params;
  const gu = findGuBySlug(slug);
  const guName = gu?.name ?? "서울";
  const dongs = gu?.dongs ?? [];
  const { catCount, urgent } = gu ? await getRegionStats(guName, dongs) : { catCount: 0, urgent: 0 };

  const dongPreview = dongs.slice(0, 4).join(" · ");
  const hasUrgent = urgent > 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 72px",
          background: "#FFFFFF",
          fontFamily: "sans-serif",
          color: OG_INK,
        }}
      >
        {/* 상단 브랜드 */}
        <OGBrand size={52} />

        {/* 메인 — 지역명 강조 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 50 }}>
          <span style={{ fontSize: 24, fontWeight: 600, color: OG_INK_LIGHT, letterSpacing: 2 }}>
            서울특별시
          </span>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -3,
              color: OG_BRAND,
              display: "flex",
            }}
          >
            {guName}
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: OG_INK,
              marginTop: 6,
              display: "flex",
            }}
          >
            길고양이 돌봄 지도
          </div>
          {dongPreview && (
            <div
              style={{
                fontSize: 24,
                color: OG_INK_SUB,
                fontWeight: 500,
                marginTop: 4,
                display: "flex",
              }}
            >
              {dongPreview} 외
            </div>
          )}
        </div>

        {/* 라이브 통계 */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: "auto",
            paddingTop: 28,
          }}
        >
          <Stat value={catCount} label={`${guName}에 등록된 아이`} />
          {hasUrgent ? (
            <Stat value={urgent} label="지금 도움이 필요해요" urgent />
          ) : (
            <Stat value={dongs.length} label={`${guName}의 동네 수`} />
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}

function Stat({
  value,
  label,
  urgent,
}: {
  value: number;
  label: string;
  urgent?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: urgent ? OG_BRAND : OG_FACE,
        borderRadius: 12,
        padding: "22px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        border: `1px solid ${urgent ? OG_BRAND : OG_LINE}`,
      }}
    >
      <span
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: urgent ? "#FFFFFF" : OG_INK,
          lineHeight: 1,
        }}
      >
        {value.toLocaleString()}
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: urgent ? "#FFFFFF" : OG_INK_SUB,
        }}
      >
        {label}
      </span>
    </div>
  );
}
