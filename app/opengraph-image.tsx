import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "도시공존 — 길고양이 돌봄 시민 참여 플랫폼";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #F6EFE3 0%, #EADFCB 55%, #DAC4A3 100%)",
          fontFamily: "sans-serif",
          color: "#2C2C2C",
          position: "relative",
        }}
      >
        {/* 장식용 패턴 */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -60,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(196,126,90,0.22) 0%, rgba(196,126,90,0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(107,142,111,0.2) 0%, rgba(107,142,111,0) 70%)",
          }}
        />

        {/* 상단 브랜드 */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              background: "#C47E5A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              boxShadow: "0 10px 30px rgba(196,126,90,0.3)",
            }}
          >
            🐾
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#A8684A", letterSpacing: 3 }}>
              DOSI GONGZON
            </span>
            <span style={{ fontSize: 42, fontWeight: 900, color: "#2C2C2C", marginTop: -4 }}>
              도시공존
            </span>
          </div>
        </div>

        {/* 메인 타이틀 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: -2,
              color: "#2C2C2C",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>길 위의 생명과 함께 걷는</span>
            <span style={{ color: "#C47E5A" }}>따뜻한 한 걸음</span>
          </div>
          <p
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: "#5A5A5A",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            우리 동네 길고양이 지도 · 돌봄 일지 · TNR 정보
          </p>
        </div>

        {/* 하단 태그 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {["🗺️ 지도", "🐾 돌봄 일지", "💬 동네 채팅", "🏥 구조 병원"].map((t) => (
            <div
              key={t}
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.75)",
                border: "2px solid rgba(196,126,90,0.25)",
                fontSize: 22,
                fontWeight: 800,
                color: "#8B5A3C",
                display: "flex",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
