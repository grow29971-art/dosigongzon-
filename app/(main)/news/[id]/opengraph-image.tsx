// 뉴스 글 페이지별 동적 OG 이미지 — 카톡·SNS 공유 시 미리보기
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { sanitizeImageUrl } from "@/lib/url-validate";
import type { NewsItem } from "@/lib/news-repo";
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
export const alt = "도시공존 — 길고양이 소식";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = Promise<{ id: string }>;

const BADGE_LABELS: Record<string, string> = {
  notice: "공지",
  event: "행사",
  policy: "정책",
  rescue: "구조",
  news: "뉴스",
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
          background: "#FFFFFF",
          fontFamily: "sans-serif",
          color: OG_INK,
        }}
      >
        {/* 이미지 영역 — 이미지 없으면 회색 면 + 분류 텍스트 */}
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
                borderRadius: 12,
                backgroundImage: `url('${image}')`,
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
              {badge}
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
            <OGBrand label="도시공존 소식" />
            <div style={{ ...OG_CHIP, padding: "6px 12px", fontSize: 17 }}>{badge}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                fontSize: 50,
                fontWeight: 700,
                lineHeight: 1.15,
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

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {sourceName && <div style={OG_CHIP}>출처 · {sourceName}</div>}
            <div style={{ ...OG_CHIP_BRAND, marginLeft: "auto" }}>dosigongzon.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
