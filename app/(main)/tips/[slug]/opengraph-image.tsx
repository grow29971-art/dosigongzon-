// 꿀팁 글 페이지별 동적 OG 이미지 — 카톡·SNS 공유 시 매력적 미리보기
import { ImageResponse } from "next/og";
import { getTipBySlugServer } from "@/lib/tips-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

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
  const thumb = sanitizeImageUrl(
    tip?.thumbnail_url ?? null,
    "https://placehold.co/800x800/EEEAE2/2A2A28?text=Tip",
  );
  const tags = (tip?.tags ?? []).slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #F6EFE3 0%, #EADFCB 55%, #DAC4A3 100%)",
          fontFamily: "sans-serif",
          color: "#2C2C2C",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(196,126,90,0.25) 0%, rgba(196,126,90,0) 70%)",
          }}
        />

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
          <div
            style={{
              width: 400,
              height: 400,
              borderRadius: 48,
              backgroundImage: `url('${thumb}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              border: "8px solid #fff",
              display: "flex",
            }}
          />
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
              💡
            </div>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#2C2C2C", letterSpacing: -0.5 }}>
              도시공존 꿀팁
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: -2,
                color: "#2C2C2C",
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
                color: "#5A5A5A",
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
              <div
                key={tag}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "rgba(196,126,90,0.18)",
                  color: "#8B5A3C",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                #{tag}
              </div>
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
                color: "#8B5A3C",
                fontSize: 18,
                fontWeight: 800,
                border: "2px solid rgba(196,126,90,0.3)",
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
