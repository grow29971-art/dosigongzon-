import type { CSSProperties, ReactElement } from "react";

/**
 * 가이드·정보 페이지용 OG 이미지 템플릿.
 * 일관된 브랜드 톤 유지 + 각 페이지별 제목·부제·뱃지만 다름.
 */
export function GuideOGTemplate({
  badge,
  badgeColor,
  title,
  subtitle,
  highlightText,
  highlightColor = "#C47E5A",
  tags,
}: {
  badge: string;              // 예: "보호지침"
  badgeColor: string;         // 뱃지 색
  title: string;              // 큰 제목 (줄바꿈 가능)
  subtitle: string;           // 한 줄 설명
  highlightText?: string;     // 제목 중 강조할 단어
  highlightColor?: string;
  tags: string[];             // 하단 태그 (이모지 포함 권장)
}): ReactElement {
  const tagBg: CSSProperties = {
    padding: "12px 22px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.8)",
    border: "2px solid rgba(196,126,90,0.25)",
    fontSize: 22,
    fontWeight: 800,
    color: "#8B5A3C",
    display: "flex",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 80px",
        background: "linear-gradient(135deg, #F6EFE3 0%, #EADFCB 55%, #DAC4A3 100%)",
        fontFamily: "sans-serif",
        color: "#2C2C2C",
        position: "relative",
      }}
    >
      {/* 장식용 원 */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -80,
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${badgeColor}33 0%, ${badgeColor}00 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -120,
          left: -100,
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(107,142,111,0.18) 0%, rgba(107,142,111,0) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 10,
          height: "100%",
          background: badgeColor,
        }}
      />

      {/* 상단: 브랜드 + 뱃지 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: "#C47E5A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              boxShadow: "0 6px 18px rgba(196,126,90,0.3)",
            }}
          >
            🐾
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#A8684A", letterSpacing: 2.4 }}>
              DOSI GONGZON
            </span>
            <span style={{ fontSize: 30, fontWeight: 900, color: "#2C2C2C", marginTop: -2 }}>
              도시공존
            </span>
          </div>
        </div>
        <div
          style={{
            padding: "12px 26px",
            borderRadius: 999,
            background: badgeColor,
            color: "#fff",
            fontSize: 22,
            fontWeight: 900,
            boxShadow: `0 6px 16px ${badgeColor}55`,
            display: "flex",
          }}
        >
          {badge}
        </div>
      </div>

      {/* 메인 타이틀 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 68,
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: -2.5,
            color: "#1E1E1E",
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {highlightText ? (
            <>
              {title.split(highlightText)[0]}
              <span style={{ color: highlightColor, display: "flex" }}>{highlightText}</span>
              {title.split(highlightText)[1] ?? ""}
            </>
          ) : (
            <span style={{ display: "flex" }}>{title}</span>
          )}
        </div>
        <p
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "#5A5A5A",
            margin: 0,
            lineHeight: 1.4,
            maxWidth: 960,
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* 하단 태그 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {tags.slice(0, 4).map((t) => (
          <div key={t} style={tagBg}>
            {t}
          </div>
        ))}
        <div
          style={{
            marginLeft: "auto",
            padding: "10px 20px",
            borderRadius: 999,
            background: "#C47E5A",
            color: "#fff",
            fontSize: 20,
            fontWeight: 900,
            display: "flex",
          }}
        >
          dosigongzon.com
        </div>
      </div>
    </div>
  );
}

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;
