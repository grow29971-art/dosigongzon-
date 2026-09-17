import { ImageResponse } from "next/og";
import { getCatByIdServer } from "@/lib/cats-server";
import { sanitizeOgImageUrl } from "@/lib/url-validate";
import { ogPhotoDataUri } from "@/lib/og-photo";
import {
  OGBrand,
  OG_CHIP,
  OG_CHIP_BRAND,
  OG_BRAND,
  OG_FACE,
  OG_INK,
  OG_INK_SUB,
  OG_LINE,
} from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "도시공존 — 길고양이 이야기";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = Promise<{ id: string }>;

export default async function CatOGImage({ params }: { params: Params }) {
  const { id } = await params;
  const cat = await getCatByIdServer(id);

  const name = cat?.name ?? "길고양이";
  const region = cat?.region ?? "우리 동네";
  // 사진이 없거나 허용 호스트 밖이면 빈 문자열 → 회색 면 + 이름으로 대체(플레이스홀더 서비스 미사용)
  // satori는 webp를 못 그리므로 sharp로 jpeg data URI로 변환해 넣는다(lib/og-photo.ts). 실패 시 회색 면.
  const photoUrl = await ogPhotoDataUri(sanitizeOgImageUrl(cat?.photo_url ?? null, ""));
  const likeCount = cat?.like_count ?? 0;
  const description = cat?.description?.slice(0, 60) ?? "길 위의 생명과 함께 걷는 따뜻한 한 걸음";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#FFFFFF",
          fontFamily: "sans-serif",
          color: OG_INK,
        }}
      >
        {/* 왼쪽: 고양이 사진(없으면 회색 면 + 이름) */}
        <div
          style={{
            width: 500,
            height: "100%",
            padding: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {photoUrl ? (
            <div
              style={{
                width: 400,
                height: 400,
                borderRadius: 12,
                backgroundImage: `url('${photoUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                border: `1px solid ${OG_LINE}`,
                display: "flex",
              }}
            />
          ) : (
            <div
              style={{
                width: 400,
                height: 400,
                borderRadius: 12,
                background: OG_FACE,
                border: `1px solid ${OG_LINE}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 44,
                fontWeight: 700,
                color: OG_INK_SUB,
                textAlign: "center",
                padding: 32,
              }}
            >
              {name}
            </div>
          )}
        </div>

        {/* 오른쪽: 텍스트 */}
        <div
          style={{
            flex: 1,
            padding: "72px 80px 64px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <OGBrand />

          {/* 이름·동 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: OG_BRAND }}>{region}</div>
            <div
              style={{
                fontSize: 80,
                fontWeight: 700,
                lineHeight: 1.0,
                letterSpacing: -2,
                color: OG_INK,
                display: "flex",
              }}
            >
              {name}
            </div>
            <p
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: OG_INK_SUB,
                margin: 0,
                lineHeight: 1.4,
                maxWidth: 520,
              }}
            >
              {description}
            </p>
          </div>

          {/* 하단 스탯 */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {likeCount > 0 && <div style={OG_CHIP}>{likeCount}명이 응원중</div>}
            <div style={OG_CHIP_BRAND}>dosigongzon.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
