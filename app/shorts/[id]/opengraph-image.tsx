// 동물숏츠 영상별 동적 OG 이미지 — 카톡·SNS 공유 시 매력적 미리보기
import { ImageResponse } from "next/og";
import { getPublishedShortServer, youTubeThumbnailUrl } from "@/lib/shorts-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

export const runtime = "nodejs";
export const alt = "도시공존 — 동물숏츠";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = Promise<{ id: string }>;

export default async function ShortOGImage({ params }: { params: Params }) {
  const { id } = await params;
  const short = await getPublishedShortServer(id);

  const title = short?.title ?? "동물숏츠";
  const description =
    short?.description?.slice(0, 80) ??
    "고양이·강아지·동물 짧은 영상 모음 — 도시공존이 큐레이션";

  // 썸네일 우선순위: 직접 업로드 thumbnail_url → YouTube 썸네일 → placeholder
  const thumbCandidate =
    short?.thumbnail_url ??
    (short?.youtube_video_id ? youTubeThumbnailUrl(short.youtube_video_id) : null);
  const thumb = sanitizeImageUrl(
    thumbCandidate,
    "https://placehold.co/1200x630/2C1810/F6EFE3?text=Shorts",
  );

  const viewCount = short?.view_count ?? 0;
  const likeCount = short?.like_count ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* 풀스크린 배경 = 영상 썸네일 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url('${thumb}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
          }}
        />
        {/* 그라데이션 오버레이 — 텍스트 가독성 확보 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.85) 100%)",
            display: "flex",
          }}
        />
        {/* 재생 아이콘 중앙 */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 70,
            boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
          }}
        >
          ▶
        </div>

        {/* 상단 브랜드 */}
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 56,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
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
            🎬
          </div>
          <span
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: -0.5,
              textShadow: "0 2px 6px rgba(0,0,0,0.6)",
            }}
          >
            동물숏츠 · 도시공존
          </span>
        </div>

        {/* 하단 제목·설명·스탯 */}
        <div
          style={{
            position: "absolute",
            left: 56,
            right: 56,
            bottom: 48,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: -2,
              color: "#fff",
              textShadow: "0 2px 10px rgba(0,0,0,0.6)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              maxWidth: 1080,
            }}
          >
            {title}
          </div>
          <p
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "rgba(255,255,255,0.9)",
              margin: 0,
              lineHeight: 1.4,
              textShadow: "0 1px 6px rgba(0,0,0,0.6)",
              maxWidth: 900,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
            {viewCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.95)",
                  color: "#2C2C2C",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                👁 {viewCount.toLocaleString()}
              </div>
            )}
            {likeCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #E86B8C 0%, #D85577 100%)",
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                ❤️ {likeCount.toLocaleString()}
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                fontSize: 18,
                fontWeight: 800,
                border: "2px solid rgba(255,255,255,0.4)",
                marginLeft: "auto",
              }}
            >
              dosigongzon.com
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
