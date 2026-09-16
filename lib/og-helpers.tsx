import type { CSSProperties, ReactElement } from "react";

/**
 * 가이드·정보 페이지용 OG 이미지 템플릿.
 * 「익숙한 동네앱」 톤(결정 0007): 순백 바탕·뉴트럴 그레이 글자·테라코타 강조·헤어라인·이모지 없음.
 * 서버 렌더 이미지(satori)라 CSS 변수를 못 쓰므로 이 파일의 인라인 hex는 정상이다.
 * 각 페이지는 제목·부제·뱃지·태그 문구만 다르다.
 */
export const OG_INK = "#191919";
export const OG_INK_SUB = "#4B4B4B";
export const OG_INK_LIGHT = "#767676";
export const OG_LINE = "#E8E8E8";
export const OG_FACE = "#F5F5F5";
export const OG_BRAND = "#B05C36";

/** 상단 브랜드 마크 + 워드마크 — 모든 OG가 공유. */
export function OGBrand({ label = "도시공존", size = 44 }: { label?: string; size?: number }): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: OG_BRAND,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: Math.round(size * 0.36),
            height: Math.round(size * 0.36),
            borderRadius: 999,
            background: "#FFFFFF",
            display: "flex",
          }}
        />
      </div>
      <span style={{ fontSize: 24, fontWeight: 700, color: OG_INK, letterSpacing: -0.5 }}>{label}</span>
    </div>
  );
}

/** 회색 면 + 헤어라인 칩 (태그·메타). */
export const OG_CHIP: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  background: OG_FACE,
  border: `1px solid ${OG_LINE}`,
  fontSize: 20,
  fontWeight: 600,
  color: OG_INK_SUB,
  display: "flex",
  alignItems: "center",
};

/** 테라코타 채움 칩 (도메인 표기·강조 1개). */
export const OG_CHIP_BRAND: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  background: OG_BRAND,
  color: "#FFFFFF",
  fontSize: 20,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
};

export function GuideOGTemplate({
  badge,
  title,
  subtitle,
  highlightText,
  tags,
}: {
  badge: string;              // 예: "보호지침"
  title: string;              // 큰 제목
  subtitle: string;           // 한 줄 설명
  highlightText?: string;     // 제목 중 테라코타로 강조할 단어
  tags: string[];             // 하단 태그(최대 4개, 이모지 없이)
}): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 80px",
        background: "#FFFFFF",
        fontFamily: "sans-serif",
        color: OG_INK,
      }}
    >
      {/* 상단: 브랜드 + 뱃지 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <OGBrand size={52} />
        <div style={OG_CHIP}>{badge}</div>
      </div>

      {/* 메인 타이틀 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -2,
            color: OG_INK,
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {highlightText ? (
            <>
              {title.split(highlightText)[0]}
              <span style={{ color: OG_BRAND, display: "flex" }}>{highlightText}</span>
              {title.split(highlightText)[1] ?? ""}
            </>
          ) : (
            <span style={{ display: "flex" }}>{title}</span>
          )}
        </div>
        <p
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: OG_INK_SUB,
            margin: 0,
            lineHeight: 1.4,
            maxWidth: 960,
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* 하단: 헤어라인 + 태그 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          paddingTop: 24,
          borderTop: `1px solid ${OG_LINE}`,
        }}
      >
        {tags.slice(0, 4).map((t) => (
          <div key={t} style={OG_CHIP}>
            {t}
          </div>
        ))}
        <div style={{ ...OG_CHIP_BRAND, marginLeft: "auto" }}>dosigongzon.com</div>
      </div>
    </div>
  );
}

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;
