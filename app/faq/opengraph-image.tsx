// FAQ 페이지 OG 이미지 — 카톡·SNS 공유 시 매력적 미리보기
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "도시공존 — 길고양이 자주 묻는 질문";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TOPICS: Array<{ label: string; emoji: string; color: string }> = [
  { label: "발견·신고", emoji: "🚨", color: "#111111" },
  { label: "새끼고양이", emoji: "🍼", color: "#E8B57E" },
  { label: "TNR·중성화", emoji: "✂️", color: "#000000" },
  { label: "임시보호·입양", emoji: "🏠", color: "#7AAE82" },
  { label: "응급·치료", emoji: "🏥", color: "#D85555" },
  { label: "법·신고", emoji: "⚖️", color: "#5F7A8E" },
  { label: "길집사 활동", emoji: "❤️", color: "#9D7AB8" },
];

export default function FaqOGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #F2F2F2 0%, #EADFCB 55%, #DAC4A3 100%)",
          fontFamily: "sans-serif",
          color: "#2A2A2A",
          position: "relative",
          padding: "64px 80px",
        }}
      >
        {/* 장식 원 */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -100,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(17, 17, 17,0.22) 0%, rgba(17, 17, 17,0) 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -80,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(232,181,126,0.25) 0%, rgba(232,181,126,0) 70%)",
            display: "flex",
          }}
        />

        {/* 브랜드 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "#111111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
            }}
          >
            ❓
          </div>
          <span
            style={{ fontSize: 24, fontWeight: 900, color: "#2A2A2A", letterSpacing: -0.5 }}
          >
            도시공존 · 자주 묻는 질문
          </span>
        </div>

        {/* 헤드라인 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -3,
              color: "#2A2A2A",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>길고양이 자주 묻는</span>
            <span style={{ color: "#111111" }}>30개 질문</span>
          </div>
          <p
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#5A5A5A",
              margin: 0,
              lineHeight: 1.45,
              maxWidth: 900,
            }}
          >
            발견·구조·TNR·임시보호·입양·학대 신고까지 — 시민이 가장 많이 묻는 질문에 답해드려요.
          </p>
        </div>

        {/* 카테고리 칩 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: "auto",
          }}
        >
          {TOPICS.map((t) => (
            <div
              key={t.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 999,
                background: `${t.color}1F`,
                color: t.color,
                fontSize: 20,
                fontWeight: 800,
                border: `2px solid ${t.color}40`,
              }}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.9)",
              color: "#555555",
              fontSize: 20,
              fontWeight: 800,
              border: "2px solid rgba(17, 17, 17,0.3)",
              marginLeft: "auto",
            }}
          >
            dosigongzon.com/faq
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
