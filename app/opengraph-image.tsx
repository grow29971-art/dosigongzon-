import { ImageResponse } from "next/og";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";
export const alt = "도시공존 — 길고양이 돌봄 시민 참여 플랫폼";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 30분 캐시 — 홈 OG는 외부 공유에 자주 노출되므로 라이브 통계 + 캐시 균형.
export const revalidate = 1800;

async function getStats() {
  try {
    const supabase = createAnonClient();
    const [catsRes, profilesRes, urgentRes, hospitalsRes] = await Promise.all([
      supabase.from("cats").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("cats").select("*", { count: "exact", head: true }).eq("health_status", "danger"),
      supabase.from("rescue_hospitals").select("*", { count: "exact", head: true }).eq("hidden", false),
    ]);
    return {
      cats: catsRes.count ?? 0,
      users: profilesRes.count ?? 0,
      urgent: urgentRes.count ?? 0,
      hospitals: hospitalsRes.count ?? 0,
    };
  } catch {
    return { cats: 0, users: 0, urgent: 0, hospitals: 0 };
  }
}

export default async function OpengraphImage() {
  const s = await getStats();
  const hasUrgent = s.urgent > 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 72px",
          background: "linear-gradient(135deg, #F6EFE3 0%, #EADFCB 55%, #DAC4A3 100%)",
          fontFamily: "sans-serif",
          color: "#2C2C2C",
          position: "relative",
        }}
      >
        {/* 장식 원 */}
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(196,126,90,0.22) 0%, rgba(196,126,90,0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -120,
            left: -100,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(107,142,111,0.2) 0%, rgba(107,142,111,0) 70%)",
          }}
        />

        {/* 상단: 브랜드 + 긴급 배지 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: "#C47E5A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 38,
                boxShadow: "0 10px 30px rgba(196,126,90,0.3)",
              }}
            >
              🐾
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#A8684A", letterSpacing: 3 }}>
                DOSI GONGZON
              </span>
              <span style={{ fontSize: 38, fontWeight: 900, color: "#2C2C2C", marginTop: -2 }}>
                도시공존
              </span>
            </div>
          </div>
          {hasUrgent && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 20px",
                borderRadius: 999,
                background: "#D85555",
                color: "#FFFFFF",
                fontSize: 22,
                fontWeight: 800,
                boxShadow: "0 8px 24px rgba(216,85,85,0.40)",
              }}
            >
              🚨 도움이 필요한 아이 {s.urgent}마리
            </div>
          )}
        </div>

        {/* 메인 카피 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 50 }}>
          <div
            style={{
              fontSize: 60,
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: -2,
              color: "#2C2C2C",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>우리 동네 길고양이,</span>
            <span style={{ color: "#C47E5A" }}>함께 기록하고 지켜요.</span>
          </div>
          <p
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: "#5A5A5A",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            서울 시민이 만든 길고양이 지도 · 돌봄 일지 · 긴급 구조
          </p>
        </div>

        {/* 라이브 통계 — 큰 숫자 3개 */}
        <div
          style={{
            display: "flex",
            gap: 18,
            marginTop: "auto",
            paddingTop: 28,
          }}
        >
          <StatCard emoji="🐾" value={s.cats} label="등록된 아이" color="#C47E5A" />
          <StatCard emoji="❤️" value={s.users} label="동네 이웃" color="#E86B8C" />
          <StatCard emoji="🏥" value={s.hospitals} label="치료 병원" color="#22B573" />
        </div>
      </div>
    ),
    { ...size },
  );
}

function StatCard({
  emoji,
  value,
  label,
  color,
}: {
  emoji: string;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.85)",
        borderRadius: 22,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        border: "2px solid rgba(196,126,90,0.20)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 28 }}>{emoji}</span>
        <span style={{ fontSize: 42, fontWeight: 900, color, lineHeight: 1 }}>
          {value.toLocaleString()}
        </span>
      </div>
      <span style={{ fontSize: 18, fontWeight: 700, color: "#6B5043" }}>{label}</span>
    </div>
  );
}
