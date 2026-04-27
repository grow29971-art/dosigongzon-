import { ImageResponse } from "next/og";
import { findGuBySlug } from "@/lib/seoul-regions";
import { getCatCountByRegionServer } from "@/lib/cats-server";
import { createAnonClient } from "@/lib/supabase/anon";

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
          background: hasUrgent
            ? "linear-gradient(135deg, #FFF1ED 0%, #FCDED4 55%, #F5B8A5 100%)"
            : "linear-gradient(135deg, #F6EFE3 0%, #EADFCB 55%, #DAC4A3 100%)",
          fontFamily: "sans-serif",
          color: "#2C2C2C",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: hasUrgent
              ? "radial-gradient(circle, rgba(216,85,85,0.22) 0%, rgba(216,85,85,0) 70%)"
              : "radial-gradient(circle, rgba(196,126,90,0.22) 0%, rgba(196,126,90,0) 70%)",
          }}
        />

        {/* 상단 브랜드 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "#C47E5A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
            }}
          >
            🐾
          </div>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#A8684A" }}>도시공존</span>
        </div>

        {/* 메인 — 지역명 강조 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 50 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#8B5A3C",
              letterSpacing: 2,
            }}
          >
            서울특별시
          </span>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: -3,
              color: hasUrgent ? "#B53D3D" : "#C47E5A",
              display: "flex",
            }}
          >
            {guName}
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "#2C2C2C",
              marginTop: 6,
              display: "flex",
            }}
          >
            길고양이 돌봄 지도
          </div>
          {dongPreview && (
            <div
              style={{
                fontSize: 22,
                color: "#6B5043",
                fontWeight: 600,
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
          <Stat
            emoji="🐾"
            value={catCount}
            label={`${guName}에 등록된 아이`}
            color="#C47E5A"
          />
          {hasUrgent ? (
            <Stat
              emoji="🚨"
              value={urgent}
              label="지금 도움이 필요해요"
              color="#D85555"
              urgent
            />
          ) : (
            <Stat
              emoji="🏘️"
              value={dongs.length}
              label={`${guName}의 동네 수`}
              color="#4A7BA8"
            />
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}

function Stat({
  emoji,
  value,
  label,
  color,
  urgent,
}: {
  emoji: string;
  value: number;
  label: string;
  color: string;
  urgent?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: urgent ? "#D85555" : "rgba(255,255,255,0.88)",
        borderRadius: 22,
        padding: "22px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        border: urgent ? "none" : "2px solid rgba(196,126,90,0.20)",
        boxShadow: urgent ? "0 12px 32px rgba(216,85,85,0.35)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 30 }}>{emoji}</span>
        <span
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: urgent ? "#FFFFFF" : color,
            lineHeight: 1,
          }}
        >
          {value.toLocaleString()}
        </span>
      </div>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: urgent ? "rgba(255,255,255,0.92)" : "#6B5043",
        }}
      >
        {label}
      </span>
    </div>
  );
}

