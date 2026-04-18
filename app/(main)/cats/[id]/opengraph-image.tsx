import { ImageResponse } from "next/og";
import { getCatByIdServer } from "@/lib/cats-server";
import { sanitizeImageUrl } from "@/lib/url-validate";

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
  const photoUrl = sanitizeImageUrl(
    cat?.photo_url ?? null,
    "https://placehold.co/800x800/EEEAE2/2A2A28?text=Cat",
  );
  const likeCount = cat?.like_count ?? 0;
  const description = cat?.description?.slice(0, 60) ?? "길 위의 생명과 함께 걷는 따뜻한 한 걸음";

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
        {/* 장식용 원 */}
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

        {/* 왼쪽: 고양이 사진 */}
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
              backgroundImage: `url('${photoUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              border: "8px solid #fff",
              display: "flex",
            }}
          />
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
          {/* 브랜드 */}
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
              도시공존
            </span>
          </div>

          {/* 이름·동 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 24,
                fontWeight: 700,
                color: "#C47E5A",
              }}
            >
              <span>📍</span>
              <span>{region}</span>
            </div>
            <div
              style={{
                fontSize: 88,
                fontWeight: 900,
                lineHeight: 1.0,
                letterSpacing: -3,
                color: "#2C2C2C",
                display: "flex",
              }}
            >
              {name}
            </div>
            <p
              style={{
                fontSize: 26,
                fontWeight: 600,
                color: "#5A5A5A",
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
            {likeCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #E86B8C 0%, #D85577 100%)",
                  color: "#fff",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                <span>❤️</span>
                <span>{likeCount}명이 응원중</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 20px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.8)",
                color: "#8B5A3C",
                fontSize: 20,
                fontWeight: 800,
                border: "2px solid rgba(196,126,90,0.3)",
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
