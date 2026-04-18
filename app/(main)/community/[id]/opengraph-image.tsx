import { ImageResponse } from "next/og";
import { getPostByIdServer } from "@/lib/posts-server";
import { CATEGORY_MAP } from "@/lib/types";
import { sanitizeImageUrl } from "@/lib/url-validate";

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
    ? sanitizeImageUrl(post.images[0], "")
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(135deg, ${cat.color}08 0%, #F6EFE3 60%, #EADFCB 100%)`,
          fontFamily: "sans-serif",
          color: "#2C2C2C",
          position: "relative",
        }}
      >
        {/* 장식 */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${cat.color}22 0%, ${cat.color}00 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 10,
            height: "100%",
            background: cat.color,
          }}
        />

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
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: "#C47E5A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                }}
              >
                🐾
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#2C2C2C", letterSpacing: -0.5 }}>
                도시공존 커뮤니티
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 999,
                background: cat.color,
                color: "#fff",
                fontSize: 22,
                fontWeight: 900,
                boxShadow: `0 6px 16px ${cat.color}55`,
              }}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </div>
          </div>

          {/* 제목 + 발췌 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
            <div
              style={{
                fontSize: 58,
                fontWeight: 900,
                lineHeight: 1.15,
                letterSpacing: -2,
                color: "#1E1E1E",
                display: "-webkit-box",
                WebkitLineClamp:2,
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
                  color: "#5A5A5A",
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
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
                border: "2px solid rgba(0,0,0,0.06)",
                fontSize: 20,
                fontWeight: 800,
                color: "#333",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>👤</span>
              <span>{author}</span>
            </div>
            {region && (
              <div
                style={{
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.85)",
                  border: "2px solid rgba(0,0,0,0.06)",
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#8B5A3C",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>📍</span>
                <span>{region}</span>
              </div>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
              {likes > 0 && (
                <div
                  style={{
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #E86B8C 0%, #D85577 100%)",
                    color: "#fff",
                    fontSize: 20,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>❤️</span>
                  <span>{likes}</span>
                </div>
              )}
              {comments > 0 && (
                <div
                  style={{
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: "rgba(74,123,168,0.95)",
                    color: "#fff",
                    fontSize: 20,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>💬</span>
                  <span>{comments}</span>
                </div>
              )}
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
                borderRadius: 36,
                backgroundImage: `url('${firstImage}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: "0 20px 44px rgba(0,0,0,0.22)",
                border: "6px solid #fff",
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
