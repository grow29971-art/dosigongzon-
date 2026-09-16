// FAQ 페이지 OG 이미지 — 카톡·SNS 공유 시 미리보기
import { ImageResponse } from "next/og";
import { OGBrand, OG_BRAND, OG_CHIP, OG_CHIP_BRAND, OG_INK, OG_INK_SUB, OG_LINE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "도시공존 — 길고양이 자주 묻는 질문";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TOPICS = ["발견·신고", "새끼고양이", "TNR·중성화", "임시보호·입양", "응급·치료", "법·신고", "길집사 활동"];

export default function FaqOGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          fontFamily: "sans-serif",
          color: OG_INK,
          padding: "64px 80px",
        }}
      >
        {/* 브랜드 */}
        <div style={{ display: "flex", marginBottom: 36 }}>
          <OGBrand label="도시공존 · 자주 묻는 질문" size={52} />
        </div>

        {/* 헤드라인 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2.5,
              color: OG_INK,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>길고양이 자주 묻는</span>
            <span style={{ color: OG_BRAND }}>30개 질문</span>
          </div>
          <p
            style={{
              fontSize: 24,
              fontWeight: 500,
              color: OG_INK_SUB,
              margin: 0,
              lineHeight: 1.45,
              maxWidth: 900,
            }}
          >
            발견·구조·TNR·임시보호·입양·학대 신고까지 — 시민이 가장 많이 묻는 질문에 답해드려요.
          </p>
        </div>

        {/* 주제 칩 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: "auto",
            paddingTop: 24,
            borderTop: `1px solid ${OG_LINE}`,
          }}
        >
          {TOPICS.map((t) => (
            <div key={t} style={OG_CHIP}>
              {t}
            </div>
          ))}
          <div style={{ ...OG_CHIP_BRAND, marginLeft: "auto" }}>dosigongzon.com/faq</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
