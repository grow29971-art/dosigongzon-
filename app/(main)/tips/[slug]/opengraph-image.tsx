// 꿀팁 글 페이지별 동적 OG 이미지 — 카톡·SNS 공유 시 미리보기
import { ImageResponse } from "next/og";
import { getTipBySlugServer } from "@/lib/tips-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import {
  OGBrand,
  OG_CHIP,
  OG_CHIP_BRAND,
  OG_FACE,
  OG_INK,
  OG_INK_SUB,
  OG_LINE,
} from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "도시공존 — 길고양이 꿀팁";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = Promise<{ slug: string }>;

export default async function TipOGImage({ params }: { params: Params }) {
  const { slug } = await params;
  // 데이터 fetch 실패해도 빈 OG는 렌더 — 삭제된 글 공유 시 500 방지.
  let tip: Awaited<ReturnType<typeof getTipBySlugServer>> = null;
  try {
    tip = await getTipBySlugServer(slug);
  } catch {
    tip = null;
  }

  const title = tip?.title ?? "도시공존 꿀팁";
  const description =
    tip?.description?.slice(0, 90) ??
    "길고양이 돌봄·TNR·임시보호 — 시민이 직접 정리한 실전 가이드";
  // 썸네일이 없으면 빈 문자열 → 회색 면 + "꿀팁" 텍스트(플레이스홀더 서비스 미사용)
  const thumb = sanitizeImageUrl(tip?.thumbnail_url ?? null, "");
  const tags = (tip?.tags ?? []).slice(0, 3);

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
          {thumb ? (
            <div
              style={{
                width: 400,
                height: 400,
                borderRadius: 12,
                backgroundImage: `url('${thumb}')`,
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
              }}
            >
              꿀팁
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            padding: "72px 80px 64px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <OGBrand label="도시공존 꿀팁" />

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: -1.5,
                color: OG_INK,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {title}
            </div>
            <p
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: OG_INK_SUB,
                margin: 0,
                lineHeight: 1.4,
                maxWidth: 560,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {tags.map((tag) => (
              <div key={tag} style={OG_CHIP}>
                #{tag}
              </div>
            ))}
            <div style={{ ...OG_CHIP_BRAND, marginLeft: "auto" }}>dosigongzon.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
