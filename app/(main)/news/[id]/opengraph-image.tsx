// 뉴스 글 페이지별 동적 OG 이미지 — 카톡·SNS 공유 시 매력적 미리보기
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { sanitizeImageUrl } from "@/lib/url-validate";
import type { NewsItem } from "@/lib/news-repo";

export const runtime = "nodejs";
export const alt = "도시공존 — 길고양이 소식";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = Promise<{ id: string }>;

const BADGE_LABELS: Record<string, { label: string; color: string }> = {
  notice: { label: "공지", color: "#C47E5A" },
  event: { label: "행사", color: "#5BA876" },
  policy: { label: "정책", color: "#4A7BA8" },
  rescue: { label: "구조", color: "#D85555" },
  news: { label: "뉴스", color: "#8B65B8" },
};

export default async function NewsOGImage({ params }: { params: Params }) {
  const { id } = await params;
  // 데이터 fetch 실패해도 빈 OG는 렌더 — 삭제된 글 공유 시 500 방지.
  let news: NewsItem | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("news").select("*").eq("id", id).maybeSingle();
    news = (data ?? null) as NewsItem | null;
  } catch {
    news = null;
  }

  const title = news?.title ?? "도시공존 소식";
  const description =
    news?.description?.slice(0, 90) ??
    news?.body?.replace(/\s+/g, " ").slice(0, 90) ??
    "길고양이·동물보호 관련 시민이 알아야 할 소식";
  const image = sanitizeImageUrl(news?.image_url ?? null, "");
  const badge = BADGE_LABELS[news?.badge_type ?? "news"] ?? BADGE_LABELS.news;
  const sourceName = news?.source_name?.slice(0, 30) ?? null;

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

        {/* 이미지 영역 — 이미지 없으면 아이콘 박스 */}
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
          {image ? (
            <div
              style={{
                width: 400,
                height: 400,
                borderRadius: 48,
                backgroundImage: `url('${image}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
                border: "8px solid #fff",
                display: "flex",
              }}
            />
          ) : (
            <div
              style={{
                width: 400,
                height: 400,
                borderRadius: 48,
                background: `linear-gradient(135deg, ${badge.color} 0%, ${badge.color}AA 100%)`,
                boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
                border: "8px solid #fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 180,
              }}
            >
              📰
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
              📰
            </div>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#2C2C2C", letterSpacing: -0.5 }}>
              도시공존 소식
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "6px 14px",
                borderRadius: 999,
                background: badge.color,
                color: "#fff",
                fontSize: 16,
                fontWeight: 800,
                marginLeft: 4,
              }}
            >
              {badge.label}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                fontSize: 50,
                fontWeight: 900,
                lineHeight: 1.15,
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
                fontSize: 22,
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

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {sourceName && (
              <div
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
                출처 · {sourceName}
              </div>
            )}
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
