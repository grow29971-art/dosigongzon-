import { ImageResponse } from "next/og";
import { getPostByIdServer } from "@/lib/posts-server";
import { CATEGORY_MAP } from "@/lib/types";
import { sanitizeOgImageUrl } from "@/lib/url-validate";
import {
  OGBrand,
  OG_CHIP,
  OG_CHIP_BRAND,
  OG_INK,
  OG_INK_LIGHT,
  OG_INK_SUB,
  OG_LINE,
} from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "도시공존 커뮤니티";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = Promise<{ id: string }>;

export default async function PostOGImage({ params }: { params: Params }) {
  const { id } = await params;
  const post = await getPostByIdServer(id);

  const category = post?.category ?? "free";
  const cat = CATEGORY_MAP[category];
  const title = post?.title ?? "도시공존 커뮤니티";
  const region = post?.region ?? "";
  const plain = (post?.content ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  const author = post?.authorName ?? "도시공존";
  const likes = post?.likeCount ?? 0;
  const comments = post?.commentCount ?? 0;
  const firstImage = post?.images?.[0]
    ? sanitizeOgImageUrl(post.images[0], "")
    : "";

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
        {/* 본문 영역 */}
        <div
          style={{
            flex: 1,
            padding: "64px 72px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* 브랜드 + 카테고리 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <OGBrand label="도시공존 커뮤니티" />
            <div style={OG_CHIP_BRAND}>{cat.label}</div>
          </div>

          {/* 제목 + 발췌 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: -1.5,
                color: OG_INK,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </div>
            {plain && (
              <p
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: OG_INK_SUB,
                  margin: 0,
                  lineHeight: 1.45,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: firstImage ? 640 : "100%",
                }}
              >
                {plain}
              </p>
            )}
          </div>

          {/* 하단: 작성자 · 통계 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingTop: 20,
              borderTop: `1px solid ${OG_LINE}`,
            }}
          >
            <div style={OG_CHIP}>{author}</div>
            {region && <div style={OG_CHIP}>{region}</div>}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 16,
                fontSize: 20,
                fontWeight: 600,
                color: OG_INK_LIGHT,
              }}
            >
              {likes > 0 && <span>공감 {likes}</span>}
              {comments > 0 && <span>댓글 {comments}</span>}
            </div>
          </div>
        </div>

        {/* 우측 이미지 (있을 때) */}
        {firstImage && (
          <div
            style={{
              width: 360,
              padding: "64px 72px 64px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 340,
                height: 340,
                borderRadius: 12,
                backgroundImage: `url('${firstImage}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                border: `1px solid ${OG_LINE}`,
                display: "flex",
              }}
            />
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
